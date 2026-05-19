import { appendFinancialAuditEventsFromIngress } from '../financial/financialAuditStore';
import { createBackendContractClient } from './client';
import type {
  ExecutionPath,
  ExecutionStateUpdateRequest,
  FinancialExportAuditRequest,
  FinancialExportDenialCode,
  IngressEvent,
  PolicyCurrentRequest,
} from './types';

const STORAGE_KEY = 'intdone_backend_contract_logs';
const MAX_ENTRIES = 200;
let memoryRows = '';

export interface BackendContractLogEntry {
  id: string;
  timestamp: string;
  endpoint:
    | 'ingestEvents'
    | 'startExecution'
    | 'updateExecutionState'
    | 'getCurrentPolicy'
    | 'financialExportAudit';
  traceId: string;
  ok: boolean;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

function appendRow(row: BackendContractLogEntry): void {
  try {
    const raw = getStorageItem(STORAGE_KEY);
    const list: BackendContractLogEntry[] = raw ? JSON.parse(raw) : [];
    list.push(row);
    setStorageItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch {
    // ignore
  }
}

export async function ingestEventsWithTrace(
  events: IngressEvent[]
): Promise<{ ok: boolean; traceId: string }> {
  const client = createBackendContractClient();
  const req = { events };
  const res = await client.ingestEvents(req);
  appendFinancialAuditEventsFromIngress(events, {
    ingestOk: res.ok,
    ingressTraceId: res.traceId,
  });
  appendRow({
    id: `btrace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    endpoint: 'ingestEvents',
    traceId: res.traceId,
    ok: res.ok,
    request: req as unknown as Record<string, unknown>,
    response: res as unknown as Record<string, unknown>,
  });
  return { ok: res.ok, traceId: res.traceId };
}

export async function startExecutionWithTrace(input: {
  intentId: string;
  executionPath: ExecutionPath;
  templateId?: string;
  topLevelCategory?: string;
  subCategoryId?: string;
}): Promise<{ executionId: string | null }> {
  const client = createBackendContractClient();
  const req = {
    intentId: input.intentId,
    executionPath: input.executionPath,
    templateId: input.templateId,
    topLevelCategory: input.topLevelCategory,
    subCategoryId: input.subCategoryId,
  };
  const res = await client.startExecution(req);
  appendRow({
    id: `btrace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    endpoint: 'startExecution',
    traceId: res.traceId,
    ok: res.ok,
    request: req as unknown as Record<string, unknown>,
    response: res as unknown as Record<string, unknown>,
  });
  return { executionId: res.ok ? res.data.executionId : null };
}

export async function updateExecutionStateWithTrace(
  req: ExecutionStateUpdateRequest
): Promise<void> {
  const client = createBackendContractClient();
  const res = await client.updateExecutionState(req);
  appendRow({
    id: `btrace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    endpoint: 'updateExecutionState',
    traceId: res.traceId,
    ok: res.ok,
    request: req as unknown as Record<string, unknown>,
    response: res as unknown as Record<string, unknown>,
  });
}

export async function getCurrentPolicyWithTrace(req: PolicyCurrentRequest): Promise<void> {
  const client = createBackendContractClient();
  const res = await client.getCurrentPolicy(req);
  appendRow({
    id: `btrace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    endpoint: 'getCurrentPolicy',
    traceId: res.traceId,
    ok: res.ok,
    request: req as unknown as Record<string, unknown>,
    response: res as unknown as Record<string, unknown>,
  });
}

export async function orchestratorDrillFromExecution(input: {
  intentId: string;
  executionPath: ExecutionPath;
  templateId?: string;
  topLevelCategory?: string;
  subCategoryId?: string;
}): Promise<void> {
  const started = await startExecutionWithTrace(input);
  if (!started.executionId) return;
  await updateExecutionStateWithTrace({
    executionId: started.executionId,
    status: 'running',
    occurredAt: new Date().toISOString(),
    message: 'stub drill running',
  });
  await updateExecutionStateWithTrace({
    executionId: started.executionId,
    status: 'succeeded',
    occurredAt: new Date().toISOString(),
    message: 'stub drill done',
  });
}

export function loadBackendContractLogs(): BackendContractLogEntry[] {
  try {
    const raw = getStorageItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function recordFinancialExportAuditWithTrace(
  input: FinancialExportAuditRequest
): Promise<void> {
  const client = createBackendContractClient();
  const res = await client.auditFinancialExport(input);
  appendRow({
    id: `btrace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    endpoint: 'financialExportAudit',
    traceId: res.traceId,
    ok: res.ok,
    request: input as unknown as Record<string, unknown>,
    response: res as unknown as Record<string, unknown>,
  });

  const occurredAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    schemaVersion: 1,
    subkind: 'financial-export-audit',
    outcome: res.ok ? 'accepted' : 'rejected-by-service',
    exportBatchId: input.exportBatchId,
    exportSessionId: input.exportSessionId,
    csvSha256: input.csvSha256,
    rowCount: input.rowCount,
    dataDomain: input.dataDomain,
    dataSensitivity: input.dataSensitivity,
    actorType: input.actorType,
    auditTraceId: res.traceId,
  };
  if (!res.ok) {
    payload.serviceError = res.error;
  }
  await ingestEventsWithTrace([
    {
      eventId: `fexp_audit_${input.exportBatchId}_${Date.now()}`,
      occurredAt,
      kind: 'audit',
      /**
       * 关联口径（无真实 DB 版本）：将财务导出链路的“会话 key”提升为 Ingress `sessionId`，
       * 便于后续服务端按 session 聚合、落库与跨服务 trace 关联（见 Stage B 契约文档 §4.2）。
       */
      sessionId: (input.exportSessionId ?? input.exportBatchId).trim(),
      payload,
    },
  ]);
}

export async function recordFinancialExportDeniedWithTrace(input: {
  actorType: string;
  actorId: string;
  dataSensitivity: string;
  reason: string;
  /** 稳定原因码；缺省为泛型拒绝，与历史日志兼容 */
  code?: FinancialExportDenialCode;
  exportSessionId?: string;
  dataDomain?: string;
  purpose?: string;
  scope?: string;
}): Promise<void> {
  const code: FinancialExportDenialCode = input.code ?? 'EXPORT_DENIED';
  const auditTraceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  appendRow({
    id: `btrace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    endpoint: 'financialExportAudit',
    traceId: auditTraceId,
    ok: false,
    request: { ...input, code } as unknown as Record<string, unknown>,
    response: { error: { code, message: input.reason } },
  });

  const occurredAt = new Date().toISOString();
  await ingestEventsWithTrace([
    {
      eventId: `fexp_denied_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      occurredAt,
      kind: 'audit',
      /**
       * 拒绝路径同样写入 sessionId，确保“拒绝/通过”在同一 correlation key 下可聚合。
       */
      sessionId: (input.exportSessionId ?? `deny_${Date.now()}`).trim(),
      payload: {
        schemaVersion: 1,
        subkind: 'financial-export-denied',
        code,
        message: input.reason,
        actorType: input.actorType,
        actorId: input.actorId,
        dataSensitivity: input.dataSensitivity,
        dataDomain: input.dataDomain,
        exportSessionId: input.exportSessionId,
        purpose: input.purpose,
        scope: input.scope,
        auditTraceId,
      },
    },
  ]);
}

function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(key);
  }
  if (key === STORAGE_KEY) return memoryRows || null;
  return null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, value);
    return;
  }
  if (key === STORAGE_KEY) {
    memoryRows = value;
  }
}

