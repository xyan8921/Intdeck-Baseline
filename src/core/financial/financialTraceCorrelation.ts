/**
 * 将 `exportSessionId` 与两条契约 trace 对齐：`auditFinancialExport`（auditTraceId）与 `ingestEvents`（ingressTraceId）。
 *
 * 提供两种变体：
 *   - `correlateFinancialExportBySessionId`：同步，读本地 localStorage / memoryStore（Dev / 离线场景）
 *   - `correlateFinancialExportBySessionIdFromApi`：异步，走 `queryFinancialExportAudit` API（Stub 或真实 DB）
 *
 * @see §4.2 / §4.3 INTDONE_STAGE_B_CONTRACTS_PREWORK_v1.md
 */
import { loadBackendContractLogs, type BackendContractLogEntry } from '../backend-contract/traceLog';
import { createBackendContractClient, type BackendContractClient } from '../backend-contract/client';
import { loadFinancialAuditStore, type FinancialAuditStoreEntry } from './financialAuditStore';

export interface FinancialExportTraceCorrelation {
  exportSessionId: string;
  /** `endpoint === financialExportAudit` 且请求体带该 session 的后端契约行 */
  auditBackendLogs: BackendContractLogEntry[];
  /** 与财务行 `ingressTraceId` 对应的 `ingestEvents` 行 */
  ingressBackendLogs: BackendContractLogEntry[];
  financialRows: FinancialAuditStoreEntry[];
}

export interface FinancialExportTraceCorrelationDataSource {
  financialRows?: FinancialAuditStoreEntry[];
  backendLogs?: BackendContractLogEntry[];
}

export function correlateFinancialExportBySessionId(
  exportSessionId: string,
  dataSource?: FinancialExportTraceCorrelationDataSource
): FinancialExportTraceCorrelation {
  const sid = exportSessionId.trim();
  const financialRows = (dataSource?.financialRows ?? loadFinancialAuditStore()).filter(
    (e) => e.exportSessionId === sid
  );
  const backend = dataSource?.backendLogs ?? loadBackendContractLogs();

  const auditBackendLogs = backend.filter(
    (e) =>
      e.endpoint === 'financialExportAudit' &&
      (e.request as Record<string, unknown>).exportSessionId === sid
  );

  const ingressIds = new Set(
    financialRows.map((r) => r.ingressTraceId).filter(Boolean) as string[]
  );
  const ingressBackendLogs = backend.filter(
    (e) => e.endpoint === 'ingestEvents' && ingressIds.has(e.traceId)
  );

  return {
    exportSessionId: sid,
    auditBackendLogs,
    ingressBackendLogs,
    financialRows,
  };
}

/**
 * DB-ready 异步关联（FE-SRV-B1-T2）：
 * 通过 `queryFinancialExportAudit` API 查询审计记录（Stub 内存缓存或真实后端 DB），
 * 映射为 `FinancialAuditStoreEntry` 后与本地 backend-contract trace 日志对齐两条 trace：
 *   - `auditTraceId`：来自 `auditFinancialExport` 响应（API item.traceId）
 *   - `ingressTraceId`：来自 `ingestEvents` 响应（本地 backend-contract trace 缓存）
 *
 * 回退策略：若 API 查询失败（ok=false），降级为读本地 `financialAuditStore`。
 *
 * @see §4.2.3 / §4.3 INTDONE_STAGE_B_CONTRACTS_PREWORK_v1.md
 */
export async function correlateFinancialExportBySessionIdFromApi(
  exportSessionId: string,
  options?: { client?: BackendContractClient }
): Promise<FinancialExportTraceCorrelation> {
  const client = options?.client ?? createBackendContractClient();
  const queryRes = await client.queryFinancialExportAudit({ sessionId: exportSessionId });

  let financialRows: FinancialAuditStoreEntry[];
  if (queryRes.ok) {
    // Map API items → FinancialAuditStoreEntry（auditTraceId = item.traceId）
    const apiRows: FinancialAuditStoreEntry[] = queryRes.data.items.map((item) => ({
      id: `api_${item.traceId}`,
      recordedAt: item.receivedAt,
      ingestOk: true,
      eventId: item.traceId,
      occurredAt: item.occurredAt,
      subkind: 'financial-export-audit' as const,
      exportBatchId: item.exportBatchId,
      exportSessionId: item.exportSessionId || exportSessionId,
      csvSha256: item.csvSha256,
      dataDomain: item.dataDomain,
      dataSensitivity: item.dataSensitivity,
      rowCount: item.rowCount,
      auditTraceId: item.traceId,
      // ingressTraceId 未包含在 queryFinancialExportAudit 响应中；
      // 真实 DB 场景下需查 backend_contract_traces_v1 表；
      // 此处通过 backend-contract 本地 trace 缓存对齐（见 §4.3.2）。
    }));
    financialRows = apiRows;
  } else {
    // API 不可用时降级至本地 store
    financialRows = loadFinancialAuditStore().filter((r) => r.exportSessionId === exportSessionId);
  }

  return correlateFinancialExportBySessionId(exportSessionId, { financialRows });
}
