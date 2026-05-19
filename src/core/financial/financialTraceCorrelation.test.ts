import { beforeEach, describe, expect, it } from 'vitest';
import { clearStubFinancialExportAuditIdempotencyCache, createStubBackendContractClient } from '../backend-contract/client';
import { loadBackendContractLogs, recordFinancialExportAuditWithTrace } from '../backend-contract/traceLog';
import { correlateFinancialExportBySessionId, correlateFinancialExportBySessionIdFromApi } from './financialTraceCorrelation';
import { loadFinancialAuditStore } from './financialAuditStore';

const FIN_KEY = 'intdone_financial_audit_events_v1';
const BACKEND_KEY = 'intdone_backend_contract_logs';
const CSV_SHA256_HEX64 = 'd'.repeat(64);

describe('financialTraceCorrelation', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem(FIN_KEY);
      localStorage.removeItem(BACKEND_KEY);
    } catch {
      // ignore
    }
    clearStubFinancialExportAuditIdempotencyCache();
  });

  it('aligns financial rows with audit and ingest backend logs by exportSessionId', async () => {
    const sessionId = `fes_corr_${Date.now()}`;
    await recordFinancialExportAuditWithTrace({
      exportBatchId: `batch_${Date.now()}`,
      exportSessionId: sessionId,
      csvSha256: CSV_SHA256_HEX64,
      actorType: 'finance',
      actorId: 'u1',
      purpose: 'reconciliation',
      scope: 'org',
      dataDomain: 'enterprise-finance',
      dataSensitivity: 'L2',
      rowCount: 1,
      occurredAt: new Date().toISOString(),
    });

    const fin = loadFinancialAuditStore();
    expect(fin.length).toBe(1);
    expect(fin[0].auditTraceId).toBeTruthy();
    expect(fin[0].ingressTraceId).toBeTruthy();
    expect(fin[0].auditTraceId).not.toBe(fin[0].ingressTraceId);

    const c = correlateFinancialExportBySessionId(sessionId);
    expect(c.financialRows).toHaveLength(1);
    expect(c.auditBackendLogs.length).toBeGreaterThanOrEqual(1);
    expect(c.auditBackendLogs.some((l) => l.traceId === fin[0].auditTraceId)).toBe(true);
    expect(c.ingressBackendLogs.length).toBeGreaterThanOrEqual(1);
    expect(c.ingressBackendLogs.some((l) => l.traceId === fin[0].ingressTraceId)).toBe(true);

    const backend = loadBackendContractLogs();
    expect(backend.some((e) => e.endpoint === 'financialExportAudit' && e.traceId === fin[0].auditTraceId)).toBe(
      true
    );
    expect(backend.some((e) => e.endpoint === 'ingestEvents' && e.traceId === fin[0].ingressTraceId)).toBe(true);
  });

  it('supports injecting external data sources (DB readiness)', async () => {
    const sessionId = `fes_external_${Date.now()}`;
    // Provide mocked data to simulate DB query results
    const c = correlateFinancialExportBySessionId(sessionId, {
      financialRows: [
        {
          id: '1',
          eventId: 'evt_1',
          occurredAt: new Date().toISOString(),
          exportSessionId: sessionId,
          exportBatchId: 'b1',
          csvSha256: CSV_SHA256_HEX64,
          subkind: 'financial-export-audit',
          recordedAt: new Date().toISOString(),
          auditTraceId: 't_audit_1',
          ingressTraceId: 't_ingress_1',
          ingestOk: true,
        },
      ],
      backendLogs: [
        {
          id: 'b1',
          timestamp: new Date().toISOString(),
          endpoint: 'financialExportAudit',
          traceId: 't_audit_1',
          ok: true,
          request: { exportSessionId: sessionId },
          response: {},
        },
        {
          id: 'b2',
          timestamp: new Date().toISOString(),
          endpoint: 'ingestEvents',
          traceId: 't_ingress_1',
          ok: true,
          request: {},
          response: {},
        },
      ],
    });

    expect(c.financialRows).toHaveLength(1);
    expect(c.auditBackendLogs).toHaveLength(1);
    expect(c.ingressBackendLogs).toHaveLength(1);
    expect(c.auditBackendLogs[0].traceId).toBe('t_audit_1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FE-SRV-B1-T2：async API 关联（DB-ready 变体）
// ─────────────────────────────────────────────────────────────────────────────

describe('correlateFinancialExportBySessionIdFromApi (FE-SRV-B1-T2)', () => {
  it('通过 queryFinancialExportAudit API 对齐 auditTraceId 与 backend-contract trace', async () => {
    const sessionId = `api_corr_${Date.now()}`;

    // 先通过 recordFinancialExportAuditWithTrace 触发完整链路（audit + ingest），
    // 此过程会向 stubFinancialExportAuditCache 写入审计记录，也会向本地 backend-contract log 写入两条 trace。
    await recordFinancialExportAuditWithTrace({
      exportBatchId: `batch_api_${Date.now()}`,
      exportSessionId: sessionId,
      csvSha256: CSV_SHA256_HEX64,
      actorType: 'finance',
      actorId: 'u_api_1',
      purpose: 'api-correlation-test',
      scope: 'org',
      dataDomain: 'enterprise-finance',
      dataSensitivity: 'L2',
      rowCount: 7,
      occurredAt: new Date().toISOString(),
    });

    // 用同一 module-level stubFinancialExportAuditCache 的 stub client 查询
    const client = createStubBackendContractClient();
    const c = await correlateFinancialExportBySessionIdFromApi(sessionId, { client });

    expect(c.exportSessionId).toBe(sessionId);
    // API 查询到 1 条记录，映射后 financialRows 有 1 项
    expect(c.financialRows).toHaveLength(1);
    expect(c.financialRows[0].auditTraceId).toBeTruthy();
    // backend-contract trace 缓存中能找到 financialExportAudit 行（auditTraceId 对齐）
    expect(c.auditBackendLogs.length).toBeGreaterThanOrEqual(1);
    expect(c.auditBackendLogs[0].traceId).toBe(c.financialRows[0].auditTraceId);
  });

  it('API 查询失败时降级至本地 financialAuditStore', async () => {
    const sessionId = `api_fallback_${Date.now()}`;

    // 先通过正常链路写入本地 store
    await recordFinancialExportAuditWithTrace({
      exportBatchId: `batch_fb_${Date.now()}`,
      exportSessionId: sessionId,
      csvSha256: CSV_SHA256_HEX64,
      actorType: 'audit',
      actorId: 'u_fb_1',
      purpose: 'fallback-test',
      scope: 'org',
      dataDomain: 'enterprise-finance',
      dataSensitivity: 'L1',
      rowCount: 3,
      occurredAt: new Date().toISOString(),
    });

    // 注入一个 queryFinancialExportAudit 总是返回 ok=false 的 mock client
    const failingClient = {
      ...createStubBackendContractClient(),
      queryFinancialExportAudit: async () => ({
        ok: false as const,
        traceId: 'mock_fail',
        error: { code: 'UNAVAILABLE', message: 'simulated DB unavailable' },
      }),
    };

    const c = await correlateFinancialExportBySessionIdFromApi(sessionId, { client: failingClient });

    // 降级：仍能从本地 store 拿到数据
    expect(c.exportSessionId).toBe(sessionId);
    expect(c.financialRows.length).toBeGreaterThanOrEqual(1);
    expect(c.financialRows[0].exportSessionId).toBe(sessionId);
  });
});
