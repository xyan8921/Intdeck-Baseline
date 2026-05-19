import { describe, expect, it } from 'vitest';
import {
  loadBackendContractLogs,
  recordFinancialExportAuditWithTrace,
  recordFinancialExportDeniedWithTrace,
} from './traceLog';

const CSV_SHA256_HEX64 = 'c'.repeat(64);

describe('backend trace log', () => {
  it('should load array safely', () => {
    const logs = loadBackendContractLogs();
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should record financial export trace', async () => {
    await recordFinancialExportAuditWithTrace({
      exportBatchId: 'fexp_test',
      exportSessionId: 'fes_test_sess',
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
    const logs = loadBackendContractLogs();
    expect(logs.some((x) => x.endpoint === 'financialExportAudit')).toBe(true);
    const ingest = logs.find((x) => x.endpoint === 'ingestEvents');
    expect(ingest).toBeTruthy();
    if (!ingest) throw new Error('expected ingestEvents log entry');
    const req = ingest.request as { events?: Array<{ sessionId?: string }> };
    expect(req.events?.[0]?.sessionId).toBe('fes_test_sess');
  });

  it('should record financial export denied trace', async () => {
    await recordFinancialExportDeniedWithTrace({
      actorType: 'operator',
      actorId: 'u2',
      dataSensitivity: 'L3',
      reason: 'EXPORT_DENIED: operator cannot export L3',
      code: 'EXPORT_DENIED_ROLE_SENSITIVITY',
    });
    const logs = loadBackendContractLogs();
    const denied = logs.filter((x) => x.endpoint === 'financialExportAudit' && x.ok === false);
    expect(denied.length).toBeGreaterThan(0);
    const last = denied[denied.length - 1];
    expect((last.response as { error?: { code?: string } }).error?.code).toBe(
      'EXPORT_DENIED_ROLE_SENSITIVITY'
    );
  });
});

