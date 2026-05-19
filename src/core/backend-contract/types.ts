/**
 * Stage B 前置：最小后端三服务契约（Ingress / Orchestrator / Policy）
 *
 * 目标：先固化“前端 ↔ 后端”的接口形状，允许本地 Stub 运行，不绑定 DB/ML。
 */

export type ISO8601 = string;

export interface ApiOk<T> {
  ok: true;
  traceId: string;
  data: T;
}

export interface ApiErr {
  ok: false;
  traceId: string;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

// ---- Ingress (事件入口) ----

export type IngressEventKind =
  | 'ui'
  | 'execution'
  | 'policy'
  | 'audit'
  | 'route-confirm'
  | 'unknown';

export interface IngressEvent {
  /** 客户端生成的事件 ID（幂等） */
  eventId: string;
  occurredAt: ISO8601;
  kind: IngressEventKind;
  /** 便于匿名统计与回放 */
  sessionId?: string;
  userSide?: 'B端' | 'C端';
  /** 与执行链关联（可空） */
  intentId?: string;
  executionId?: string;
  payload: Record<string, unknown>;
}

export interface IngressIngestRequest {
  events: IngressEvent[];
}

export interface IngressIngestResponse {
  accepted: number;
}

// ---- Orchestrator (执行编排) ----

export type ExecutionPath = 'template' | 'keyword-generic';
export type ExecutionStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface ExecutionStartRequest {
  intentId: string;
  executionPath: ExecutionPath;
  templateId?: string;
  topLevelCategory?: string;
  subCategoryId?: string;
  params?: Record<string, unknown>;
}

export interface ExecutionStartResponse {
  executionId: string;
  status: ExecutionStatus;
}

export interface ExecutionStateUpdateRequest {
  executionId: string;
  status: ExecutionStatus;
  stepId?: string;
  message?: string;
  occurredAt: ISO8601;
}

export interface ExecutionStateUpdateResponse {
  status: ExecutionStatus;
}

// ---- Policy (策略下发) ----

export interface PolicyClientContext {
  appProfile: 'full' | 'mobile-lite';
  userSide: 'B端' | 'C端';
  region: 'cn' | 'global';
  stage: string;
}

export interface PolicySnapshot {
  /** 策略 schema 版本：用于兼容升级与回放 */
  schemaVersion: 1;
  version: string;
  publishedAt: ISO8601;
  flags: Record<string, boolean>;
  thresholds: Record<string, number>;
  weights: Record<string, number>;
}

export interface PolicyCurrentRequest {
  context: PolicyClientContext;
}

export interface PolicyCurrentResponse {
  policy: PolicySnapshot;
}

// ---- Finance Export Audit (财务导出审计) ----

export type FinancialExportActorType = 'audit' | 'finance' | 'finance-api' | 'operator';
export type FinancialDataDomain = 'enterprise-finance' | 'personal-spending';
export type FinancialDataSensitivity = 'L1' | 'L2' | 'L3' | 'L4';

/** 财务导出拒绝的稳定原因码（审计/回放；优先于自由文本 message） */
export type FinancialExportDenialCode =
  | 'EXPORT_DENIED_ROLE_SENSITIVITY'
  | 'EXPORT_DENIED_POLICY_DISABLED'
  | 'EXPORT_DENIED_POLICY_UNAVAILABLE'
  | 'EXPORT_DENIED_ETHICS'
  | 'EXPORT_DENIED';

export interface FinancialExportAuditRequest {
  exportBatchId: string;
  /**
   * 单次导出会话 ID（manifest 同源）。**HTTP 客户端**会作为 `X-Idempotency-Key` 发送；
   * **Stub** 对相同 key 的 `auditFinancialExport` 返回同一 `receivedAt`（重试安全）。
   *
   * **可观测关联**：`auditFinancialExport` 响应 `traceId` → 写入 Ingress `audit` payload 的 `auditTraceId`；
   * 随后 `ingestEvents` 响应 `traceId` → 落入本地 `financialAuditStore` 的 `ingressTraceId`。
   * Dev 可用 `correlateFinancialExportBySessionId(exportSessionId)` 对齐两条契约行与财务行。
   */
  exportSessionId?: string;
  /** UTF-8 CSV 的 SHA-256 十六进制摘要（64 字符）；客户端校验见 `validateFinancialExportAuditRequest` */
  csvSha256: string;
  actorType: FinancialExportActorType;
  actorId: string;
  purpose: string;
  scope: string;
  dataDomain: FinancialDataDomain;
  dataSensitivity: FinancialDataSensitivity;
  rowCount: number;
  occurredAt: ISO8601;
}

export interface FinancialExportAuditResponse {
  accepted: boolean;
  receivedAt: ISO8601;
}

export interface FinancialExportAuditQueryRequest {
  sessionId?: string;
  batchId?: string;
  actorId?: string;
}

export interface FinancialExportAuditQueryItem {
  exportSessionId: string;
  exportBatchId: string;
  csvSha256: string;
  actorType: FinancialExportActorType;
  actorId: string;
  purpose: string;
  scope: string;
  dataDomain: FinancialDataDomain;
  dataSensitivity: FinancialDataSensitivity;
  rowCount: number;
  occurredAt: ISO8601;
  receivedAt: ISO8601;
  traceId: string; // The backend generated trace ID for this audit
}

export interface FinancialExportAuditQueryResponse {
  items: FinancialExportAuditQueryItem[];
}

