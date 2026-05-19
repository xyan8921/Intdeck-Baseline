import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearStubFinancialExportAuditIdempotencyCache,
  createBackendContractClient,
  createStubBackendContractClient,
  getBackendContractRuntimeInfo,
} from './client';

const CSV_SHA256_HEX64 = 'b'.repeat(64);

describe('stub backend contract client', () => {
  beforeEach(() => {
    clearStubFinancialExportAuditIdempotencyCache();
  });
  it('should accept events', async () => {
    const client = createStubBackendContractClient();
    const res = await client.ingestEvents({
      events: [
        {
          eventId: 'e1',
          occurredAt: new Date().toISOString(),
          kind: 'ui',
          payload: { a: 1 },
        },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.accepted).toBe(1);
    }
  });

  it('should return policy snapshot', async () => {
    const client = createStubBackendContractClient();
    const res = await client.getCurrentPolicy({
      context: { appProfile: 'full', userSide: 'C端', region: 'cn', stage: 'stage0' },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.policy.version).toBe('stub-v1');
      expect(typeof res.data.policy.flags.enableDevWorkspace).toBe('boolean');
    }
  });

  it('should accept financial export audit request', async () => {
    const client = createStubBackendContractClient();
    const res = await client.auditFinancialExport({
      exportBatchId: 'fexp_1',
      csvSha256: CSV_SHA256_HEX64,
      actorType: 'finance',
      actorId: 'u1',
      purpose: 'reconciliation',
      scope: 'org',
      dataDomain: 'enterprise-finance',
      dataSensitivity: 'L2',
      rowCount: 2,
      occurredAt: new Date().toISOString(),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.accepted).toBe(true);
    }
  });

  it('should reject audit with invalid csvSha256 (shared validation)', async () => {
    const client = createStubBackendContractClient();
    const res = await client.auditFinancialExport({
      exportBatchId: 'fexp_1',
      csvSha256: 'not64hex',
      actorType: 'finance',
      actorId: 'u1',
      purpose: 'p',
      scope: 's',
      dataDomain: 'enterprise-finance',
      dataSensitivity: 'L2',
      rowCount: 1,
      occurredAt: new Date().toISOString(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('EXPORT_AUDIT_INVALID_CSV_SHA256');
    }
  });

  it('should return same receivedAt for duplicate exportSessionId (stub idempotency)', async () => {
    const client = createStubBackendContractClient();
    const base = {
      exportBatchId: 'fexp_a',
      exportSessionId: 'fes_same_session',
      csvSha256: CSV_SHA256_HEX64,
      actorType: 'finance' as const,
      actorId: 'u1',
      purpose: 'p',
      scope: 's',
      dataDomain: 'enterprise-finance' as const,
      dataSensitivity: 'L2' as const,
      rowCount: 1,
      occurredAt: new Date().toISOString(),
    };
    const r1 = await client.auditFinancialExport(base);
    const r2 = await client.auditFinancialExport({ ...base, exportBatchId: 'fexp_b' });
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r2.data.receivedAt).toBe(r1.data.receivedAt);
      expect(r2.traceId).toBe(r1.traceId);
    }
  });

  it('should fallback to stub when http has no baseUrl', async () => {
    const client = createBackendContractClient({ mode: 'http', baseUrl: '' });
    const res = await client.ingestEvents({ events: [] });
    expect(res.ok).toBe(true);
  });

  it('should expose runtime info with defaults', () => {
    const info = getBackendContractRuntimeInfo({ mode: 'stub', baseUrl: '' });
    expect(info.mode).toBe('stub');
    expect(info.timeoutMs).toBeGreaterThan(0);
    expect(info.retries).toBeGreaterThanOrEqual(0);
  });
});

