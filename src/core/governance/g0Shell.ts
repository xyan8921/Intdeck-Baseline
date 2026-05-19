import { sha256HexOfUtf8Text } from '../financial/exportAudit';
import { buildUnifiedAuditEventV1, type AuditVerdict } from '../observability/unifiedAuditSchema';
import { appendExperienceFromG0ActionReport } from '../experience/experienceStore';
import { appendG0ActionReport } from './g0ReportStore';
import type {
  G0ActionOutcome,
  G0ActionReportV1,
  G0ActorContext,
  G0CorrelationKeys,
  G0ModuleKey,
  G0PurposeScope,
} from './g0Types';

function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return '"<unserializable>"';
  }
}

async function shaOfSnapshot(v: unknown): Promise<string> {
  return sha256HexOfUtf8Text(safeJsonStringify(v));
}

function normalizeOutcome(outcome: G0ActionOutcome): { verdict: AuditVerdict; outcome: G0ActionOutcome } {
  if (outcome === 'blocked') return { verdict: 'block', outcome };
  if (outcome === 'failed') return { verdict: 'revise', outcome };
  if (outcome === 'succeeded') return { verdict: 'allow', outcome };
  return { verdict: 'unknown', outcome: 'unknown' };
}

function validateMandatoryFields(input: {
  module: G0ModuleKey;
  action: string;
  actor: G0ActorContext;
  purposeScope: G0PurposeScope;
}): string | null {
  if (!input.module || input.module === 'unknown') return 'G0: module required';
  if (!input.action?.trim()) return 'G0: action required';
  if (!input.actor?.actorType || !input.actor?.actorId) return 'G0: actor required';
  if (!input.purposeScope?.purpose?.trim() || !input.purposeScope?.scope?.trim()) {
    return 'G0: purpose and scope required';
  }
  return null;
}

/**
 * G0 执行壳：对任意“动作”统一挂载摘要层、hash、审计 envelope，并落入本地报告 store。
 * v1.0：不强制接 Policy/Ethics 评估，但保留 `auditEventV1` 字段与 correlation 以便后续接闸门。
 */
export async function runG0Action<T>(input: {
  module: G0ModuleKey;
  action: string;
  actor: G0ActorContext;
  purposeScope: G0PurposeScope;
  correlation?: G0CorrelationKeys;
  inputSnapshot?: unknown;
  /** 执行动作；抛错将转为 failed，并记录 errorMessage */
  fn: () => Promise<T>;
}): Promise<{ ok: boolean; report: G0ActionReportV1; output?: T }> {
  const startedAt = new Date().toISOString();
  const id = `g0_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let outputSnapshot: unknown = undefined;
  let outcome: G0ActionOutcome = 'unknown';
  let errorMessage: string | undefined;

  const invalid = validateMandatoryFields(input);
  if (invalid) {
    outcome = 'blocked';
    errorMessage = invalid;
    const report = await buildReport({
      id,
      recordedAt: startedAt,
      module: input.module,
      action: input.action,
      actor: input.actor,
      purposeScope: input.purposeScope,
      correlation: input.correlation,
      inputSnapshot: input.inputSnapshot,
      outputSnapshot,
      outcome,
      errorMessage,
    });
    appendG0ActionReport(report);
    // Experience Store：不阻塞主路径；失败不影响 G0 报告落地。
    void appendExperienceFromG0ActionReport(report);
    return { ok: false, report };
  }

  try {
    const out = await input.fn();
    outputSnapshot = out as unknown;
    outcome = 'succeeded';
    const report = await buildReport({
      id,
      recordedAt: startedAt,
      module: input.module,
      action: input.action,
      actor: input.actor,
      purposeScope: input.purposeScope,
      correlation: input.correlation,
      inputSnapshot: input.inputSnapshot,
      outputSnapshot,
      outcome,
    });
    appendG0ActionReport(report);
    void appendExperienceFromG0ActionReport(report);
    return { ok: true, report, output: out };
  } catch (e) {
    const rawMessage = e instanceof Error ? e.message : '未知错误';
    if (rawMessage.startsWith('G0_BLOCK:')) {
      outcome = 'blocked';
      errorMessage = rawMessage.slice('G0_BLOCK:'.length).trim() || 'blocked';
    } else {
      outcome = 'failed';
      errorMessage = rawMessage;
    }
    const report = await buildReport({
      id,
      recordedAt: startedAt,
      module: input.module,
      action: input.action,
      actor: input.actor,
      purposeScope: input.purposeScope,
      correlation: input.correlation,
      inputSnapshot: input.inputSnapshot,
      outputSnapshot,
      outcome,
      errorMessage,
    });
    appendG0ActionReport(report);
    void appendExperienceFromG0ActionReport(report);
    return { ok: false, report };
  }
}

async function buildReport(input: {
  id: string;
  recordedAt: string;
  module: G0ModuleKey;
  action: string;
  actor: G0ActorContext;
  purposeScope: G0PurposeScope;
  correlation?: G0CorrelationKeys;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
  outcome: G0ActionOutcome;
  errorMessage?: string;
}): Promise<G0ActionReportV1> {
  const inputSha256 = input.inputSnapshot === undefined ? undefined : await shaOfSnapshot(input.inputSnapshot);
  const outputSha256 = input.outputSnapshot === undefined ? undefined : await shaOfSnapshot(input.outputSnapshot);
  const normalized = normalizeOutcome(input.outcome);

  return {
    schemaVersion: 1,
    id: input.id,
    recordedAt: input.recordedAt,
    module: input.module,
    action: input.action,
    actor: input.actor,
    purposeScope: input.purposeScope,
    correlation: input.correlation,
    summary: {
      who: { actorType: input.actor.actorType, actorId: input.actor.actorId },
      why: { purpose: input.purposeScope.purpose, scope: input.purposeScope.scope },
      what: { module: input.module, action: input.action },
      result: { outcome: normalized.outcome, errorMessage: input.errorMessage },
      hash: { inputSha256, outputSha256 },
    },
    inputSnapshot: input.inputSnapshot,
    outputSnapshot: input.outputSnapshot,
    auditEventV1: buildUnifiedAuditEventV1({
      rulesTriggered: [],
      verdict: normalized.verdict,
      reason: input.errorMessage,
      correlation: {
        channel: 'g0_action',
        g0ActionId: input.id,
        module: input.module,
        action: input.action,
        ...(input.correlation ?? {}),
      },
      surfaceHint: 'unknown',
    }),
  };
}

