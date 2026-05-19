import { describe, expect, it, vi } from 'vitest';
import type { G0ActionReportV1 } from '../governance/g0Types';
import { appendExperienceFromG0ActionReport, buildExperienceExportPackage, loadExperienceItems } from './experienceStore';

function makeReport(): G0ActionReportV1 {
  return {
    schemaVersion: 1,
    id: 'g0_test_1',
    recordedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
    module: 'ops_console',
    action: 'test_action',
    actor: { actorType: 'human', actorId: 'u_1' },
    purposeScope: { purpose: 'test', scope: 'unit' },
    correlation: { sessionId: 's_1', traceId: 't_1' },
    summary: {
      who: { actorType: 'human', actorId: 'u_1' },
      why: { purpose: 'test', scope: 'unit' },
      what: { module: 'ops_console', action: 'test_action' },
      result: { outcome: 'succeeded' },
      hash: {},
    },
    inputSnapshot: { a: 1 },
    outputSnapshot: { ok: true },
    auditEventV1: {
      schemaVersion: 1,
      surface: 'unknown',
      verdict: 'allow',
      rulesTriggered: [],
      correlation: { channel: 'g0_action', g0ActionId: 'g0_test_1' },
    },
  };
}

describe('experienceStore', () => {
  it('should append experience item derived from g0 report', async () => {
    // ensure memory mode (no window/localStorage)
    vi.stubGlobal('window', undefined as unknown as Window);

    const report = makeReport();
    const item = await appendExperienceFromG0ActionReport(report);
    const list = loadExperienceItems();

    expect(list.length).toBeGreaterThan(0);
    expect(list[list.length - 1]?.id).toBe(item.id);
    expect(item.source.g0ReportId).toBe(report.id);
    expect(item.source.reportSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(item.summary.what.action).toBe('test_action');
  });

  it('should build export package with manifest', () => {
    const pkg = buildExperienceExportPackage([
      {
        schemaVersion: 1,
        id: 'exp_1',
        createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
        source: {
          kind: 'g0_action_report_v1',
          g0ReportId: 'g0_1',
          recordedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
          module: 'ops_console',
          action: 'a',
          reportSha256: '0'.repeat(64),
        },
        summary: makeReport().summary,
      },
    ]);

    expect(pkg.manifest.schemaVersion).toBe(1);
    expect(pkg.manifest.itemCount).toBe(1);
    expect(pkg.items[0]?.id).toBe('exp_1');
  });

  it('should include intdeckAgentRuntime in manifest when provided', () => {
    const runtime = {
      schemaVersion: 1 as const,
      loadedFrom: '/tmp/cfg.json',
      configSha256: 'a'.repeat(64),
      capabilities: { llm: false, thirdPartyAPI: false, networkEgress: 'deny' as const },
    };
    const pkg = buildExperienceExportPackage([], { intdeckAgentRuntime: runtime });
    expect(pkg.manifest.itemCount).toBe(0);
    expect(pkg.manifest.intdeckAgentRuntime?.configSha256).toBe(runtime.configSha256);
  });
});

