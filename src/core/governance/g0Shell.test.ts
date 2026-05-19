import { describe, expect, it, beforeEach } from 'vitest';
import { loadG0ActionReports } from './g0ReportStore';
import { runG0Action } from './g0Shell';

describe('g0Shell', () => {
  beforeEach(() => {
    // vitest node env: provide minimal localStorage mock
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => void store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
      } satisfies Storage,
      configurable: true,
    });

    globalThis.localStorage.removeItem('intdone_g0_action_reports_v1');
  });

  it('blocks when purpose/scope missing (fail-closed)', async () => {
    const res = await runG0Action({
      module: 'ops_console',
      action: 'ops.test.missing_purpose',
      actor: { actorType: 'human', actorId: 'u1' },
      purposeScope: { purpose: '', scope: '' },
      fn: async () => ({ ok: true }),
    });

    expect(res.ok).toBe(false);
    expect(res.report.summary.result.outcome).toBe('blocked');
    expect(res.report.summary.result.errorMessage).toMatch(/purpose and scope required/i);

    const reports = loadG0ActionReports();
    expect(reports.length).toBe(1);
    expect(reports[0].id).toBe(res.report.id);
  });
});

