import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendFinancialAuditEventsFromIngress,
  loadFinancialAuditStore,
} from './financialAuditStore';

const KEY = 'intdone_financial_audit_events_v1';

describe('financialAuditStore', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  });

  it('filters subkinds, dedupes audit by session+hash, and persists', () => {
    const occurredAt = new Date().toISOString();
    appendFinancialAuditEventsFromIngress(
      [
        {
          eventId: 'evt_denied_1',
          occurredAt,
          kind: 'audit',
          payload: {
            schemaVersion: 1,
            subkind: 'financial-export-denied',
            code: 'EXPORT_DENIED_ROLE_SENSITIVITY',
            message: 'blocked',
          },
        },
        {
          eventId: 'x',
          occurredAt,
          kind: 'audit',
          payload: { schemaVersion: 1, subkind: 'route-confirm' },
        },
      ],
      { ingestOk: true }
    );
    let rows = loadFinancialAuditStore();
    expect(rows).toHaveLength(1);
    expect(rows[0].subkind).toBe('financial-export-denied');

    const t = new Date().toISOString();
    appendFinancialAuditEventsFromIngress(
      [
        {
          eventId: 'e1',
          occurredAt: t,
          kind: 'audit',
          payload: {
            schemaVersion: 1,
            subkind: 'financial-export-audit',
            exportSessionId: 'fes_dup',
            csvSha256: 'hash1',
            exportBatchId: 'b1',
            outcome: 'accepted',
          },
        },
        {
          eventId: 'e2',
          occurredAt: t,
          kind: 'audit',
          payload: {
            schemaVersion: 1,
            subkind: 'financial-export-audit',
            exportSessionId: 'fes_dup',
            csvSha256: 'hash1',
            exportBatchId: 'b1',
            outcome: 'accepted',
          },
        },
      ],
      { ingestOk: true }
    );
    rows = loadFinancialAuditStore();
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.subkind === 'financial-export-audit')).toHaveLength(1);
  });

  it('stores ingressTraceId when provided by ingest path', () => {
    const occurredAt = new Date().toISOString();
    appendFinancialAuditEventsFromIngress(
      [
        {
          eventId: 'evt_ing',
          occurredAt,
          kind: 'audit',
          payload: {
            schemaVersion: 1,
            subkind: 'financial-export-audit',
            exportSessionId: 'fes_ing',
            csvSha256: 'h',
            auditTraceId: 'trace_audit_x',
          },
        },
      ],
      { ingestOk: true, ingressTraceId: 'trace_ingress_y' }
    );
    const rows = loadFinancialAuditStore();
    expect(rows[rows.length - 1].ingressTraceId).toBe('trace_ingress_y');
    expect(rows[rows.length - 1].auditTraceId).toBe('trace_audit_x');
  });
});
