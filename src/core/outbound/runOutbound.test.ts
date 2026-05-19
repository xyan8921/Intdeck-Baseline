import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localEthicsGuard } from '../ethics/LocalEthicsGuard';
import { runOutbound } from './runOutbound';

describe('runOutbound', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem('intdone_unified_audit_ring_v1');
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs fn when ethics allows', async () => {
    const v = await runOutbound('financial', 'audit-export', async () => 42);
    expect(v).toBe(42);
  });

  it('throws when ethics blocks', async () => {
    vi.spyOn(localEthicsGuard, 'checkCandidate').mockResolvedValue({
      verdict: 'block',
      reason: 'outbound test block',
    });
    await expect(runOutbound('office', 'x', async () => 1)).rejects.toThrow('outbound test block');
  });

  it('throws when E2 requires confirmation but userConfirmed false', async () => {
    await expect(
      runOutbound('financial', 'sync', async () => 1, { requiresUserConfirmation: true })
    ).rejects.toThrow(/user confirmation required/i);
  });

  it('runs when requires confirmation and user confirmed', async () => {
    const v = await runOutbound('financial', 'sync', async () => 99, {
      requiresUserConfirmation: true,
      userConfirmed: true,
    });
    expect(v).toBe(99);
  });
});
