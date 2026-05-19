import type { UnifiedAuditEventV1 } from '../observability/unifiedAuditSchema';

/** G0：受监管执行壳（Governance-First）在 Dev 端的最小契约 */

/**
 * 已知 G0 模块的命名常量（Sprint A）。
 * 新模块直接用字符串字面量传入，无需修改此处；
 * 添加到 G0_MODULE_REGISTRY 仅为 IDE 自动补全与可见性。
 */
export const G0_MODULE_REGISTRY = {
  OPS_CONSOLE: 'ops_console',
  GROWTH_FACTORY: 'growth_factory',
  GOVERNANCE: 'governance',
  UNKNOWN: 'unknown',
} as const;

export type KnownG0ModuleKey = (typeof G0_MODULE_REGISTRY)[keyof typeof G0_MODULE_REGISTRY];

/**
 * G0 模块 key：已知值提供自动补全，允许任意字符串以支持扩展（不需改此类型）。
 * `(string & {})` 保留字面量 union 的 IDE 提示，同时接受新增模块名。
 */
export type G0ModuleKey = KnownG0ModuleKey | (string & Record<string, never>);

export type G0ActionOutcome = 'succeeded' | 'failed' | 'blocked' | 'unknown';

export interface G0ActorContext {
  actorType: 'human' | 'agent' | 'system';
  actorId: string;
  /** 可选：前端无法可靠获取 IP，保留字段用于后端/网关填充 */
  ip?: string;
  userAgent?: string;
}

export interface G0PurposeScope {
  purpose: string;
  scope: string;
  dataDomain?: string;
  dataSensitivity?: string;
}

export interface G0CorrelationKeys {
  /** 同一条业务链路的会话级关联键（建议） */
  sessionId?: string;
  /** 可选：与财务导出链路对齐 */
  exportSessionId?: string;
  /** 可选：与 Ingress/契约 trace 对齐 */
  traceId?: string;
  /** 可选：与引擎意图或项目对齐 */
  intentId?: string;
  projectId?: string;
}

export interface G0ActionSummary {
  who: Pick<G0ActorContext, 'actorType' | 'actorId'>;
  why: Pick<G0PurposeScope, 'purpose' | 'scope'>;
  what: {
    module: G0ModuleKey;
    action: string;
  };
  result: {
    outcome: G0ActionOutcome;
    errorMessage?: string;
  };
  hash: {
    inputSha256?: string;
    outputSha256?: string;
  };
}

export interface G0ActionReportV1 {
  schemaVersion: 1;
  id: string;
  recordedAt: string;
  module: G0ModuleKey;
  action: string;
  actor: G0ActorContext;
  purposeScope: G0PurposeScope;
  correlation?: G0CorrelationKeys;
  /** 可审计摘要层（who/why/what/result/hash） */
  summary: G0ActionSummary;
  /** 供 Dev 回放：输入/输出快照（可裁剪；未来可改为指针） */
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
  /** 与统一 audit schema 对齐（可为空，取决于是否触发规则/闸门） */
  auditEventV1?: UnifiedAuditEventV1;
}

