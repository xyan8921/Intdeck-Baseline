import { describe, expect, it } from 'vitest';
import type { FinancialExportAuditRequest } from './types';
import { validateFinancialExportAuditRequest } from './validateFinancialExportAuditRequest';

const HEX64 = 'a'.repeat(64);
const baseTime = '2026-04-21T12:00:00.000Z';

function validBase() {
  return {
    exportBatchId: 'fexp_1',
    csvSha256: HEX64,
    actorType: 'finance' as const,
    actorId: 'u1',
    purpose: 'reconciliation',
    scope: 'org',
    dataDomain: 'enterprise-finance' as const,
    dataSensitivity: 'L2' as const,
    rowCount: 2,
    occurredAt: baseTime,
  };
}

describe('validateFinancialExportAuditRequest', () => {
  it('accepts minimal valid request', () => {
    expect(validateFinancialExportAuditRequest(validBase())).toEqual({ valid: true });
  });

  it('rejects bad csvSha256', () => {
    const r = validateFinancialExportAuditRequest({ ...validBase(), csvSha256: 'abc' });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.code).toBe('EXPORT_AUDIT_INVALID_CSV_SHA256');
    }
  });

  it('rejects empty exportSessionId when present', () => {
    const r = validateFinancialExportAuditRequest({ ...validBase(), exportSessionId: '   ' });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.code).toBe('EXPORT_AUDIT_INVALID_EXPORT_SESSION_ID');
    }
  });

  it('rejects invalid actorType', () => {
    const r = validateFinancialExportAuditRequest({
      ...validBase(),
      actorType: 'admin',
    } as unknown as FinancialExportAuditRequest);
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.code).toBe('EXPORT_AUDIT_INVALID_ACTOR_TYPE');
    }
  });

  it('rejects non-integer rowCount', () => {
    const r = validateFinancialExportAuditRequest({ ...validBase(), rowCount: 1.5 });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.code).toBe('EXPORT_AUDIT_INVALID_ROW_COUNT');
    }
  });

  it('rejects unparseable occurredAt', () => {
    const r = validateFinancialExportAuditRequest({ ...validBase(), occurredAt: 'not-a-date' });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.code).toBe('EXPORT_AUDIT_INVALID_OCCURRED_AT');
    }
  });
});
