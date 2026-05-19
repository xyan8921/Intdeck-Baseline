/**
 * DevPhaseSkill — AI 开发助手阶段规划 Skill
 *
 * 职责：
 *   1. 读取 ai-dev-assistant.json 阶段配置
 *   2. 生成结构化的阶段开发计划（tasks / checks / docs / threats）
 *   3. 写入 G0 审计日志（每次 plan 生成均可追溯）
 *   4. 输出 SkillOutput.content = DevPhasePlan（JSON）
 *
 * 伦理覆盖：E3（可解释）、E4（可回退 — 规划不代执行）、E6（审计可追溯）
 *
 * @see docs/AI_DEV_ASSISTANT_WORKFLOW_v1.md
 * @see config/ai-dev-assistant.json
 * @see INTDONE_TECH_PLAN_v1.md §0.2.4
 */

import type { Skill, SkillInput, SkillOutput } from '../types';
import type { SystemMeta } from '../../system/types';
import { appendUnifiedAuditRingEvent } from '../../observability/unifiedAuditRingLog';
import { buildUnifiedAuditEventV1 } from '../../observability/unifiedAuditSchema';
import type {
  DevPhaseSkillInput,
  DevPhasePlan,
  DevTask,
  DevPhaseId,
  SelfCheckGateId,
  ThreatScenarioId,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 静态阶段任务表（与 ai-dev-assistant.json phases 对应）
// 新增阶段只需在此追加，不改 Skill 核心逻辑
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_TASK_TABLE: Record<string, DevTask[]> = {
  'B1': [
    {
      id: 'B1-T1',
      title: '确认 stub/http client 工厂 timeout/retry/错误映射覆盖',
      filePath: 'src/core/backend-contract/',
      action: 'verify',
      priority: 'P0',
      ethicalPrinciples: ['E6'],
      acceptanceCriteria: ['HTTP timeout 可配置', 'retry 次数有上限', '错误码映射至 FinancialExportDenialCode'],
      threatScenarios: ['T2-egress', 'T4-audit-gap'],
      done: true,
    },
    {
      id: 'B1-T2',
      title: '/dev/logs 四类请求连通性自检入口可用',
      filePath: 'src/pages/dev/DevLogsPage.tsx',
      action: 'verify',
      priority: 'P0',
      ethicalPrinciples: ['E6'],
      acceptanceCriteria: ['ingest / start / update / policy 四类请求均有自检按钮', 'Dev /dev/logs 展示结果'],
      threatScenarios: ['T4-audit-gap'],
      done: true,
    },
    {
      id: 'B1-T3',
      title: '财务导出审计 FE-SRV-A1 请求体共用校验落地',
      filePath: 'src/core/backend-contract/validateFinancialExportAuditRequest.ts',
      action: 'verify',
      priority: 'P0',
      ethicalPrinciples: ['E3', 'E6'],
      acceptanceCriteria: ['Stub 与 HTTP client 同源 validateFinancialExportAuditRequest', 'EXPORT_AUDIT_INVALID_* 码覆盖'],
      threatScenarios: ['T4-audit-gap', 'T5-idempotency'],
      done: true,
    },
    {
      id: 'B1-T4',
      title: '进入 FE-SRV-B1：无 DB 口径 correlation key 确认',
      filePath: 'docs/INTDONE_STAGE_B_CONTRACTS_PREWORK_v1.md',
      action: 'doc-backfill',
      priority: 'P1',
      ethicalPrinciples: ['E6'],
      acceptanceCriteria: ['§4.2 correlation key 口径已落地文档'],
      threatScenarios: ['T4-audit-gap'],
      done: true,
    },
    {
      id: 'B1-T5',
      title: 'AI Dev Assistant Skill & Workflow 交付（本阶段新增）',
      filePath: 'src/core/skills/dev/',
      action: 'create',
      priority: 'P1',
      ethicalPrinciples: ['E3', 'E4', 'E6'],
      acceptanceCriteria: [
        'DevPhaseSkill / DevSelfCheckSkill / DevDocBackfillSkill 可实例化',
        'dev-phase-runner.mjs 可运行 --dry-run',
        'dev-phase-workflow.json 加载可过 WorkflowEngine',
        'redteamGate.devWorkflow.test.ts 全绿',
        'docs/AI_DEV_ASSISTANT_WORKFLOW_v1.md 已回填',
      ],
      threatScenarios: ['T1-injection', 'T2-egress', 'T4-audit-gap'],
      done: true,
    },
  ],
  'FE-SRV-B1': [
    {
      id: 'FE-SRV-B1-T1',
      title: '审计 DB 落库方案设计（非 localStorage + Stub 占位）',
      filePath: 'docs/INTDONE_STAGE_B_CONTRACTS_PREWORK_v1.md',
      action: 'doc-backfill',
      priority: 'P0',
      ethicalPrinciples: ['E6'],
      acceptanceCriteria: ['DB schema 草案已写入文档', '写入路径与 financialAuditStore 对齐'],
      threatScenarios: ['T4-audit-gap'],
      done: true,
    },
    {
      id: 'FE-SRV-B1-T2',
      title: 'trace / exportSessionId 跨服务关联深化',
      filePath: 'src/core/financial/',
      action: 'modify',
      priority: 'P0',
      ethicalPrinciples: ['E6'],
      acceptanceCriteria: ['correlateFinancialExportBySessionId 可在有 DB 场景下对齐两条 trace'],
      threatScenarios: ['T4-audit-gap', 'T5-idempotency'],
      done: true,
    },
    {
      id: 'FE-SRV-B1-T3',
      title: '红队覆盖：T5-idempotency 重复提交场景验证',
      filePath: 'src/core/redteam/redteamGate.devWorkflow.test.ts',
      action: 'modify',
      priority: 'P1',
      ethicalPrinciples: ['E6'],
      acceptanceCriteria: ['重复 exportSessionId 不产生双写'],
      threatScenarios: ['T5-idempotency'],
      done: true,
    },
  ],
  'B2': [
    {
      id: 'B2-T1',
      title: '威胁模型白皮书 v0 §4.1 扩展（含 T3/T5/T7）',
      filePath: 'docs/INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md',
      action: 'modify',
      priority: 'P0',
      ethicalPrinciples: ['E3', 'E6'],
      acceptanceCriteria: ['T3/T5/T7 场景已写入白皮书', '与 ai-dev-assistant.json threatModel 对齐'],
      threatScenarios: ['T3-privilege', 'T5-idempotency', 'T7-data-sovereignty'],
      done: false,
    },
    {
      id: 'B2-T2',
      title: '红队最小集扩展（dev-workflow 专项）进 CI',
      filePath: 'src/core/redteam/redteamGate.devWorkflow.test.ts',
      action: 'verify',
      priority: 'P0',
      ethicalPrinciples: ['E6'],
      acceptanceCriteria: ['npm run redteam:v0 覆盖 devWorkflow 测试'],
      threatScenarios: ['T1-injection', 'T2-egress', 'T3-privilege', 'T4-audit-gap'],
      done: false,
    },
    {
      id: 'B2-T3',
      title: 'baseline export dry-run 通过',
      filePath: 'scripts/export-intdeck-baseline.mjs',
      action: 'verify',
      priority: 'P1',
      ethicalPrinciples: ['E6'],
      acceptanceCriteria: ['npm run export:intdeck-baseline -- --dry-run 返回 0'],
      threatScenarios: ['T6-supply-chain'],
      done: false,
    },
  ],
};

const PHASE_META_TABLE: Record<string, {
  name: string;
  techPlanRef: string;
  requiredChecks: SelfCheckGateId[];
  docsToBackfill: string[];
  threatScenarios: ThreatScenarioId[];
  crossRefs: string[];
}> = {
  'B1': {
    name: '阶段 B1 — 后端 HTTP Client 骨架',
    techPlanRef: 'INTDONE_TECH_PLAN_v1.md §4.x 阶段 B B1',
    requiredChecks: ['lint', 'test', 'build', 'smoke:profile', 'redteam:v0'],
    docsToBackfill: ['docs/INTDONE_TECH_PLAN_v1.md', 'docs/INTDONE_STAGE_B_CONTRACTS_PREWORK_v1.md', 'DEPLOYMENT.md'],
    threatScenarios: ['T1-injection', 'T2-egress', 'T4-audit-gap', 'T5-idempotency'],
    crossRefs: ['INTDONE_FINANCIAL_ARCHITECTURE_v1.md §3', 'INTDONE_ETHICS_RULE_ALIGNMENT_v1.md v1.4.1'],
  },
  'FE-SRV-B1': {
    name: 'FE-SRV-B1 — 审计 DB 落库与 trace 跨服务关联',
    techPlanRef: 'INTDONE_TECH_PLAN_v1.md §4.8.1 FE-SRV-B1',
    requiredChecks: ['lint', 'test', 'build', 'redteam:v0'],
    docsToBackfill: ['docs/INTDONE_TECH_PLAN_v1.md', 'docs/INTDONE_STAGE_B_CONTRACTS_PREWORK_v1.md'],
    threatScenarios: ['T2-egress', 'T4-audit-gap', 'T5-idempotency'],
    crossRefs: ['INTDONE_FINANCIAL_ARCHITECTURE_v1.md', 'INTDONE_STAGE_B_CONTRACTS_PREWORK_v1.md §4.2'],
  },
  'B2': {
    name: '阶段 B2 — 威胁模型白皮书 + 红队扩展',
    techPlanRef: 'INTDONE_TECH_PLAN_v1.md §0.2.2 B2',
    requiredChecks: ['lint', 'test', 'build', 'redteam:v0', 'export:intdeck-baseline'],
    docsToBackfill: ['docs/INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md', 'docs/INTDONE_TECH_PLAN_v1.md'],
    threatScenarios: ['T1-injection', 'T2-egress', 'T3-privilege', 'T4-audit-gap', 'T5-idempotency', 'T6-supply-chain'],
    crossRefs: ['INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md', 'DEPLOYMENT.md R2-b'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Skill 实现
// ─────────────────────────────────────────────────────────────────────────────

export class DevPhaseSkill implements Skill {
  id = 'dev-phase-planner';
  type = 'guidance' as const;
  metadata = {
    name: 'AI 开发阶段规划器',
    description:
      '读取技术计划阶段配置，生成结构化开发任务列表、自检清单、威胁模型覆盖表与文档回填清单。不代执行任何任务，仅输出可审计的规划草案（E4：建议/待确认）。',
    requiresNetwork: false,
    ethicalPrinciples: ['E3', 'E4', 'E6'] as ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[],
  };

  async execute(input: SkillInput, meta: SystemMeta): Promise<SkillOutput> {
    const typedInput = input as unknown as DevPhaseSkillInput;
    const phaseId: DevPhaseId = typedInput.phaseId ?? 'FE-SRV-B1';
    const mode = typedInput.mode ?? 'plan';
    const completedTaskIds = typedInput.completedTaskIds ?? [];

    const phaseMeta = PHASE_META_TABLE[phaseId] ?? {
      name: `阶段 ${phaseId}（未定义）`,
      techPlanRef: 'INTDONE_TECH_PLAN_v1.md',
      requiredChecks: ['lint', 'test', 'build', 'redteam:v0'] as SelfCheckGateId[],
      docsToBackfill: ['docs/INTDONE_TECH_PLAN_v1.md'],
      threatScenarios: [] as ThreatScenarioId[],
      crossRefs: [],
    };

    const rawTasks: DevTask[] = (PHASE_TASK_TABLE[phaseId] ?? []).map((t) => ({
      ...t,
      done: completedTaskIds.includes(t.id) || t.done,
    }));

    const pendingTasks = rawTasks.filter((t) => !t.done);

    const plan: DevPhasePlan = {
      schemaVersion: 1,
      phaseId,
      phaseName: phaseMeta.name,
      status: pendingTasks.length === 0 ? 'done' : 'in-progress',
      generatedAt: new Date().toISOString(),
      tasks: mode === 'next-tasks' ? pendingTasks.slice(0, 3) : rawTasks,
      requiredChecks: phaseMeta.requiredChecks,
      docsToBackfill: phaseMeta.docsToBackfill,
      threatScenarios: phaseMeta.threatScenarios,
      crossRefs: phaseMeta.crossRefs,
      techPlanRef: phaseMeta.techPlanRef,
      summary: this._buildSummary(phaseId, rawTasks, pendingTasks),
    };

    // E6：写入统一审计环形缓冲
    appendUnifiedAuditRingEvent(
      buildUnifiedAuditEventV1({
        rulesTriggered: [],
        verdict: 'allow',
        reason: `DevPhaseSkill: 生成 ${phaseId} 阶段规划（mode=${mode}，tasks=${rawTasks.length}）`,
        correlation: {
          channel: 'dev_phase_skill',
          phaseId,
          mode,
          stage: meta.stage,
        },
        surfaceHint: 'workflow',
      })
    );

    const content = JSON.stringify(plan, null, 2);

    return {
      content,
      format: 'application/json',
      metadata: {
        skillId: this.id,
        timestamp: Date.now(),
        confidence: 1.0,
        phaseId,
        mode,
        totalTasks: rawTasks.length,
        pendingTasks: pendingTasks.length,
      },
    };
  }

  private _buildSummary(phaseId: DevPhaseId, all: DevTask[], pending: DevTask[]): string {
    const done = all.length - pending.length;
    const pct = all.length > 0 ? Math.round((done / all.length) * 100) : 0;
    if (pending.length === 0) {
      return `阶段 ${phaseId} 全部任务已完成（${all.length}/${all.length}）。可运行自检门禁后关闭本阶段。`;
    }
    const topTask = pending[0];
    return (
      `阶段 ${phaseId} 进度 ${pct}%（${done}/${all.length}）。` +
      `当前最高优先级任务：[${topTask.priority}] ${topTask.title}。` +
      `待完成 ${pending.length} 项，完成后运行 npm run dev:check --phase=${phaseId} 触发自检。`
    );
  }
}
