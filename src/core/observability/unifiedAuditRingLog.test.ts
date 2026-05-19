import { beforeEach, describe, expect, it } from 'vitest';
import { appendUnifiedAuditRingEvent, loadUnifiedAuditRing } from './unifiedAuditRingLog';
import { buildUnifiedAuditFromEthicsDecision } from './unifiedAuditSchema';

const KEY = 'intdone_unified_audit_ring_v1';

describe('unifiedAuditRingLog', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  });

  it('appends and loads', () => {
    expect(loadUnifiedAuditRing()).toHaveLength(0);
    appendUnifiedAuditRingEvent(
      buildUnifiedAuditFromEthicsDecision({
        verdict: 'allow',
        rulesTriggered: ['ethics.e2.outbound.pass-screen'],
      }),
    );
    const rows = loadUnifiedAuditRing();
    expect(rows).toHaveLength(1);
    expect(rows[0].auditEventV1.surface).toBe('outbound');
  });
});
