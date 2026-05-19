/**
 * Dev Skill 类型定义
 *
 * 供 DevPhaseSkill / DevSelfCheckSkill / DevDocBackfillSkill 共用。
 * 这些 Skill 的消费方：
 *   - 浏览器侧：/dev/workflow-lab（规划可视化）
 *   - CLI 侧：scripts/dev-phase-runner.mjs（自动化执行）
 *
 * @see docs/AI_DEV_ASSISTANT_WORKFLOW_v1.md
 * @see config/ai-dev-assistant.json
 * @see INTDONE_TECH_PLAN_v1.md §0.2.4
 */

// ─────────────────────────────────────────────────────────────────────────────
// 阶段与门禁
// ─────────────────────────────────────────────────────────────────────────────

/** 技术计划中定义的阶段 ID（见 ai-dev-assistant.json phases） */
export type DevPhaseId =
  | 'stage-A'
  | 'B0'
  | 'B1'
  | 'FE-SRV-B1'
  | 'B2'
  | 'B3'
  | 'stage-C'
  | 'stage-D'
  | string; // 允许扩展

export type PhaseStatus = 'done' | 'in-progress' | 'pending' | 'blocked';

/** 自检门禁 ID */
export type SelfCheckGateId =
  | 'lint'
  | 'test'
  | 'build'
  | 'smoke:profile'
  | 'redteam:v0'
  | 'lint:themes'
  | 'export:intdeck-baseline';

/** 单个门禁结果 */
export interface GateResult {
  gate: SelfCheckGateId;
  cmd: string;
  passed: boolean;
  /** 耗时 ms */
  durationMs: number;
  /** 失败时的错误摘要（前 512 字符） */
  errorSummary?: string;
}

/** 自检报告 */
export interface SelfCheckReport {
  schemaVersion: 1;
  phaseId: DevPhaseId;
  ranAt: string; // ISO
  overallPassed: boolean;
  gates: GateResult[];
  /** 未通过的门禁 ID 列表 */
  failedGates: SelfCheckGateId[];
  /** 下一步建议（自动生成） */
  nextStepSuggestion?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 威胁模型与红队
// ─────────────────────────────────────────────────────────────────────────────

/** 威胁场景 ID（见 ai-dev-assistant.json threatModel.scenarios） */
export type ThreatScenarioId =
  | 'T1-injection'
  | 'T2-egress'
  | 'T3-privilege'
  | 'T4-audit-gap'
  | 'T5-idempotency'
  | 'T6-supply-chain'
  | 'T7-data-sovereignty'
  | string;

/** 红队场景结果 */
export interface RedteamScenarioResult {
  scenarioId: ThreatScenarioId;
  description: string;
  mitigationVerified: boolean;
  evidence?: string;
}

/** 红队报告 */
export interface RedteamReport {
  schemaVersion: 1;
  phaseId: DevPhaseId;
  ranAt: string;
  overallPassed: boolean;
  scenarios: RedteamScenarioResult[];
  uncoveredScenarios: ThreatScenarioId[];
  /** 建议新增的红队用例 */
  suggestedNewCases?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 开发阶段规划
// ─────────────────────────────────────────────────────────────────────────────

/** 一个可执行的开发任务 */
export interface DevTask {
  id: string;
  title: string;
  /** 文件路径（新建/修改/删除） */
  filePath?: string;
  action: 'create' | 'modify' | 'delete' | 'verify' | 'doc-backfill';
  priority: 'P0' | 'P1' | 'P2';
  /** 关联的伦理原则 */
  ethicalPrinciples?: ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[];
  /** 验收口径 */
  acceptanceCriteria?: string[];
  /** 关联的威胁场景 */
  threatScenarios?: ThreatScenarioId[];
  done: boolean;
}

/** 阶段规划输出 */
export interface DevPhasePlan {
  schemaVersion: 1;
  phaseId: DevPhaseId;
  phaseName: string;
  status: PhaseStatus;
  generatedAt: string; // ISO
  tasks: DevTask[];
  requiredChecks: SelfCheckGateId[];
  docsToBackfill: string[];
  threatScenarios: ThreatScenarioId[];
  crossRefs: string[];
  /** 与技术计划的对应章节 */
  techPlanRef: string;
  /** 阶段总结（3-6 句，供 PR 描述） */
  summary?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 文档回填
// ─────────────────────────────────────────────────────────────────────────────

/** 文档回填项 */
export interface DocBackfillItem {
  docPath: string;
  section?: string;
  updateType: 'status-mark' | 'cross-ref' | 'new-section' | 'milestone-row';
  description: string;
  /** 建议的 commit message */
  suggestedCommit?: string;
}

/** 文档回填报告 */
export interface DocBackfillReport {
  schemaVersion: 1;
  phaseId: DevPhaseId;
  generatedAt: string;
  items: DocBackfillItem[];
  /** 统一 commit 建议（多文档批量回填时） */
  batchCommitSuggestion?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dev Skill 输入/输出（具体 SkillInput 子类）
// ─────────────────────────────────────────────────────────────────────────────

export interface DevPhaseSkillInput {
  phaseId: DevPhaseId;
  mode: 'plan' | 'summary' | 'next-tasks';
  /** 可选：当前已完成的任务 ID 列表 */
  completedTaskIds?: string[];
}

export interface DevSelfCheckSkillInput {
  phaseId: DevPhaseId;
  /** 要运行的门禁子集（省略则按 phase config 全跑） */
  gates?: SelfCheckGateId[];
  /** 是否 dry-run（只生成检查列表，不实际执行） */
  dryRun?: boolean;
}

export interface DevDocBackfillSkillInput {
  phaseId: DevPhaseId;
  /** 本阶段实际完成的交付物列表 */
  deliverables: string[];
  /** 是否触发红队相关文档更新 */
  includeRedteamDocs?: boolean;
}
