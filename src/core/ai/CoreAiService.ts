import type {
  AiCoreService,
  ClarifyInput,
  ClarifyOutput,
  PlanInput,
  PlanOutput,
  VariationInput,
  VariationOutput,
  KeywordInput,
  KeywordOutput,
  AiCoreLogEntry,
  AiCoreOperation,
  EthicsDecision,
} from './types';
import { localContentShield } from '../shield/LocalContentShield';
import { localEthicsGuard } from '../ethics/LocalEthicsGuard';
import type { EthicsInput } from '../ethics/types';
import { getAiConfig } from './config/loadAiConfig';
import { appendUnifiedAuditRingEvent } from '../observability/unifiedAuditRingLog';
import {
  buildUnifiedAuditForCoreAiStep,
  buildUnifiedAuditFromEthicsDecision,
} from '../observability/unifiedAuditSchema';
import { isDevWorkspacePath } from '@/config/devWorkspace';
import { createSystemMeta } from '../system/types';
import { runG0LlmCall } from '../governance/g0LlmGate';
import type { G0ActorContext, G0CorrelationKeys } from '../governance/g0Types';

const AI_CORE_LOG_STORAGE_KEY = 'intdone_ai_core_logs';

function buildDevActor(userId: string): G0ActorContext {
  return {
    actorType: 'human',
    actorId: userId || 'dev-user',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
}

/**
 * 调用后端 LLM 代理接口。
 * 成功返回解析后的数据，任何失败（网络/服务端错误/未启动）返回 null，
 * 调用方降级到本地静态配置，用户无感知。
 */
async function callLlm<T>(args: {
  path: string;
  body: unknown;
  actorId: string;
  correlation?: G0CorrelationKeys;
  promptSnapshot?: unknown;
}): Promise<T | null> {
  // 关键边界：远端 LLM 仅允许在 Dev 端(/dev/*) 且显式开关开启时使用，
  // C/B 产品通路必须保持模板/本地驱动，避免“发布通路”与 Dev 试验通道混淆。
  const enableRemoteLlm = (import.meta.env.VITE_ENABLE_REMOTE_LLM as string | undefined) === 'true';
  const inDevWorkspace =
    typeof window !== 'undefined' && isDevWorkspacePath(window.location.pathname);
  if (!enableRemoteLlm || !inDevWorkspace) return null;

  try {
    // Stage1（Dev 端试验）将远端 LLM 纳入 G0 Pre-LLM gate，以产出可审计证据链。
    // 仍保持“失败自动降级到静态配置”的体验（即：捕获并返回 null）。
    const meta = createSystemMeta({
      stage: 'stage1',
      capabilities: {
        llm: true,
        payment: false,
        thirdPartyAPI: true,
        userStorage: 'local',
      },
      compliance: {
        contentShield: 'local',
        dataResidency: 'user-device',
        auditLogging: true,
      },
    });

    const out = await runG0LlmCall<T>({
      meta,
      llm: { provider: 'other', model: 'remote-llm-proxy' },
      actor: buildDevActor(args.actorId),
      purposeScope: { purpose: 'dev-llm-experiment', scope: 'intdeck-dev' },
      correlation: args.correlation,
      promptSnapshot: args.promptSnapshot ?? { path: args.path },
      fn: async () => {
        const res = await fetch(`/api/llm/${args.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args.body),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = (await res.json()) as { ok: boolean; data: T };
        if (!json.ok) {
          throw new Error('remote llm proxy returned ok=false');
        }
        return json.data;
      },
    });
    return out;
  } catch {
    return null;
  }
}

async function appendLog(entry: AiCoreLogEntry): Promise<void> {
  try {
    const existingRaw = window.localStorage.getItem(AI_CORE_LOG_STORAGE_KEY);
    const existing: AiCoreLogEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.push(entry);
    window.localStorage.setItem(AI_CORE_LOG_STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed to append AiCoreLogEntry:', e);
  }
}

function createLogEntry(
  operation: AiCoreOperation,
  projectId: string,
  userId: string,
  inputSnapshot: unknown,
  outputSnapshot: unknown,
  metaSnapshot: unknown
): AiCoreLogEntry {
  return {
    id: `aiCore_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    projectId,
    userId,
    operation,
    inputSnapshot,
    outputSnapshot,
    metaSnapshot,
  };
}

export class CoreAiService implements AiCoreService {
  private async enforceEthics<T>(
    input: EthicsInput,
    output: T,
    opts?: { coreAiOperation?: AiCoreOperation }
  ): Promise<{ finalOutput: T; ethicsDecision: EthicsDecision }> {
    const ethicsDecision = await localEthicsGuard.checkCandidate(input);
    if (ethicsDecision.verdict === 'block') {
      appendUnifiedAuditRingEvent(
        buildUnifiedAuditFromEthicsDecision(ethicsDecision, {
          channel: 'core_ai_enforce_block',
          coreAiOperation: opts?.coreAiOperation,
          ethicsSubjectLabel: input.subject.label,
        })
      );
      throw new Error(ethicsDecision.reason || '内容被伦理规则拦截');
    }
    const finalOutput =
      ethicsDecision.verdict === 'revise' && ethicsDecision.effectiveOutput
        ? (ethicsDecision.effectiveOutput as T)
        : output;
    return { finalOutput, ethicsDecision };
  }

  async clarifyIntent(input: ClarifyInput): Promise<ClarifyOutput> {
    const cfg = getAiConfig(input.templateId);

    // 优先调用 LLM；后端未启动或失败时自动降级到静态配置
    const llmResult = await callLlm<{ questions: ClarifyOutput['questions'] }>({
      path: 'clarify',
      body: { rawDescription: input.rawDescription, templateId: input.templateId },
      actorId: input.userId,
      correlation: { projectId: input.projectId },
      promptSnapshot: {
        kind: 'core-ai-clarify',
        coreAiOperation: 'clarify',
        templateId: input.templateId,
        rawDescription: input.rawDescription,
      },
    });
    const questions = llmResult?.questions ?? cfg.clarifyQuestions;

    const output: ClarifyOutput = {
      questions,
      draftMeta: { rawDescription: input.rawDescription },
    };

    const { finalOutput, ethicsDecision } = await this.enforceEthics<ClarifyOutput>(
      {
        subject: {
          type: 'output_text',
          label: 'core_ai_clarify',
        },
        meta: input.metaSnapshot,
        candidate: output,
      },
      output,
      { coreAiOperation: 'clarify' }
    );

    const log = createLogEntry(
      'clarify',
      input.projectId,
      input.userId,
      input,
      finalOutput,
      input.metaSnapshot
    );
    log.ethicsDecision = ethicsDecision;
    log.auditEventV1 = buildUnifiedAuditForCoreAiStep({
      ethics: ethicsDecision,
      correlation: { coreAiOperation: 'clarify' },
    });
    await appendLog(log);

    return finalOutput;
  }

  async generateInitialPlan(input: PlanInput): Promise<PlanOutput> {
    const cfg = getAiConfig(input.templateId);

    const llmResult = await callLlm<PlanOutput>({
      path: 'plan',
      body: { confirmedMeta: input.confirmedMeta, templateId: input.templateId },
      actorId: input.userId,
      correlation: { projectId: input.projectId },
      promptSnapshot: {
        kind: 'core-ai-plan',
        coreAiOperation: 'plan',
        templateId: input.templateId,
        confirmedMeta: input.confirmedMeta,
      },
    });
    const output: PlanOutput = {
      tasks: llmResult?.tasks ?? cfg.planTasks,
      milestones: llmResult?.milestones ?? cfg.planMilestones,
    };

    const { finalOutput, ethicsDecision } = await this.enforceEthics<PlanOutput>(
      {
        subject: {
          type: 'plan',
          label: 'core_ai_plan',
        },
        meta: input.confirmedMeta,
        candidate: output,
      },
      output,
      { coreAiOperation: 'plan' }
    );

    const log = createLogEntry(
      'plan',
      input.projectId,
      input.userId,
      input,
      finalOutput,
      input.confirmedMeta
    );
    log.ethicsDecision = ethicsDecision;
    log.auditEventV1 = buildUnifiedAuditForCoreAiStep({
      ethics: ethicsDecision,
      correlation: { coreAiOperation: 'plan' },
    });
    await appendLog(log);

    return finalOutput;
  }

  async suggestVariations(input: VariationInput): Promise<VariationOutput> {
    const cfg = getAiConfig(input.templateId);

    const llmResult = await callLlm<VariationOutput>({
      path: 'variations',
      body: { basePlan: input.basePlan, constraints: input.constraints },
      actorId: input.userId,
      correlation: { projectId: input.projectId },
      promptSnapshot: {
        kind: 'core-ai-variations',
        coreAiOperation: 'variation',
        templateId: input.templateId,
        basePlan: input.basePlan,
        constraints: input.constraints,
      },
    });
    const output: VariationOutput = {
      variations: llmResult?.variations ?? cfg.variations,
    };

    const { finalOutput, ethicsDecision } = await this.enforceEthics<VariationOutput>(
      {
        subject: {
          type: 'plan',
          label: 'core_ai_variation',
        },
        meta: input.basePlan,
        candidate: output,
      },
      output,
      { coreAiOperation: 'variation' }
    );

    const log = createLogEntry(
      'variation',
      input.projectId,
      input.userId,
      input,
      finalOutput,
      input.basePlan
    );
    log.ethicsDecision = ethicsDecision;
    log.auditEventV1 = buildUnifiedAuditForCoreAiStep({
      ethics: ethicsDecision,
      correlation: { coreAiOperation: 'variation' },
    });
    await appendLog(log);

    return finalOutput;
  }

  async extractKeywords(input: KeywordInput): Promise<KeywordOutput> {
    const fp = input.finalPlan as { templateId?: string; subCategoryId?: string } | undefined;
    const cfg = getAiConfig(fp?.templateId, fp?.subCategoryId);

    const llmResult = await callLlm<KeywordOutput>({
      path: 'keywords',
      body: { finalPlan: input.finalPlan },
      actorId: input.userId,
      correlation: { projectId: input.projectId },
      promptSnapshot: { kind: 'core-ai-keywords', coreAiOperation: 'keywords', finalPlan: input.finalPlan },
    });
    const keywords = llmResult?.keywords ?? [...cfg.keywords.list];
    const briefText = llmResult?.brief ?? cfg.keywords.brief;

    const shieldResult = await localContentShield.checkText(briefText);
    const safeBrief = shieldResult.passed
      ? briefText
      : '儿童生日派对基础方案（简要版），具体细节请在本地根据家庭情况调整。';

    const output: KeywordOutput = {
      keywords,
      brief: safeBrief,
    };

    const { finalOutput, ethicsDecision } = await this.enforceEthics<KeywordOutput>(
      {
        subject: {
          type: 'output_text',
          label: 'core_ai_keywords_brief',
        },
        meta: input.finalPlan,
        candidate: output,
      },
      output,
      { coreAiOperation: 'keywords' }
    );

    const log = createLogEntry(
      'keywords',
      input.projectId,
      input.userId,
      input,
      finalOutput,
      input.finalPlan
    );
    log.ethicsDecision = ethicsDecision;
    log.auditEventV1 = buildUnifiedAuditForCoreAiStep({
      ethics: ethicsDecision,
      additionalRules: shieldResult.rulesTriggered,
      correlation: {
        coreAiOperation: 'keywords',
        shieldPassed: shieldResult.passed,
      },
    });
    await appendLog(log);

    return finalOutput;
  }
}

export const coreAiService = new CoreAiService();

