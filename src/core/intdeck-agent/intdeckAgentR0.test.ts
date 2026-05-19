import { describe, expect, it, vi } from 'vitest';
import { loadExperienceItems } from '../experience/experienceStore';
import { runG0Action } from '../governance/g0Shell';
import { loadG0ActionReports } from '../governance/g0ReportStore';

describe('intdeck agent R0 (memory parity with CLI)', () => {
  it('persists g0 report and experience after runG0Action', async () => {
    vi.stubGlobal('window', undefined as unknown as Window);

    const res = await runG0Action({
      module: 'ops_console',
      action: 'intdeck-agent:r0-test',
      actor: { actorType: 'human', actorId: 'cli_test' },
      purposeScope: { purpose: 'test', scope: 'intdeck-agent-r0' },
      inputSnapshot: { n: 1 },
      fn: async () => ({ ok: true }),
    });

    await new Promise((r) => setTimeout(r, 80));

    expect(loadG0ActionReports().some((r) => r.id === res.report.id)).toBe(true);
    const exp = loadExperienceItems().filter((e) => e.source.g0ReportId === res.report.id);
    expect(exp.length).toBeGreaterThanOrEqual(1);
    expect(exp[0]?.source.reportSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
