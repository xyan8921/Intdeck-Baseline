import { describe, expect, it } from 'vitest';
import { renderReplaySummaryMarkdownV1, type ReplayResultsJsonV1 } from './replaySummaryMarkdown';

function makePayload(overrides?: Partial<ReplayResultsJsonV1>): ReplayResultsJsonV1 {
  return {
    summary: {
      ok: true,
      itemsReplayed: 1,
      blocked: false,
      exportedAt: '2026-01-01T00:00:00.000Z',
      storedConfigSha256: 'a'.repeat(64),
      currentConfigSha256: 'b'.repeat(64),
      driftSummary: { total: 0, regressionFields: [], upgradeFields: [] },
      note: 'read-only replay note',
    },
    session: {
      schemaVersion: 1,
      sessionId: 'sess_1',
      actor: { actorType: 'human', actorId: 'cli_local' },
      startedAt: '2026-01-01T00:00:00.000Z',
      status: 'active',
      executionTrace: [],
      manifest: {
        schemaVersion: 1,
        loadedFrom: 'test',
        configSha256: 'b'.repeat(64),
        capabilities: { llm: false, thirdPartyAPI: false, networkEgress: 'deny' },
      },
    },
    results: [
      {
        experienceItemId: 'exp_1',
        ok: true,
        reportId: 'g0_1',
        outcome: 'succeeded',
        capabilityDrift: [],
      },
    ],
    ...overrides,
  };
}

describe('renderReplaySummaryMarkdownV1', () => {
  it('包含关键字段与 items 列表', () => {
    const md = renderReplaySummaryMarkdownV1(makePayload());
    expect(md).toMatch(/# Intdeck Agent replay summary/);
    expect(md).toMatch(/itemsReplayed: \*\*1\*\*/);
    expect(md).toMatch(/## Items/);
    expect(md).toMatch(/`exp_1`/);
    expect(md).toMatch(/outcome=`succeeded`/);
    expect(md).toMatch(/## Note/);
  });

  it('当 storedConfigSha256=null 时输出为 null', () => {
    const md = renderReplaySummaryMarkdownV1(
      makePayload({
        summary: {
          ...makePayload().summary,
          storedConfigSha256: null,
        },
      })
    );
    expect(md).toMatch(/stored=`null`/);
  });

  it('当存在 drift 时输出 drift 细节', () => {
    const md = renderReplaySummaryMarkdownV1(
      makePayload({
        summary: {
          ...makePayload().summary,
          blocked: true,
        },
        results: [
          {
            experienceItemId: 'exp_1',
            ok: false,
            reportId: 'g0_1',
            outcome: 'blocked',
            capabilityDrift: [
              {
                field: 'networkEgress',
                stored: 'allowlist',
                current: 'deny',
                severity: 'regression',
                description: 'networkEgress allowlist→deny：回放出站工具调用将被阻止',
              },
            ],
          },
        ],
      })
    );
    expect(md).toMatch(/drift=1/);
    expect(md).toMatch(/## Blocked reason/);
    expect(md).toMatch(/\*\*regression\*\*/);
    expect(md).toMatch(/`networkEgress`/);
  });

  it('传入 options 时输出 files 与 command', () => {
    const md = renderReplaySummaryMarkdownV1(makePayload(), {
      outDir: 'out/intdeck-agent-cli',
      generatedAt: '2026-01-01T00:00:00.000Z',
      command: 'npm run intdeck:agent -- replay --outDir=out/intdeck-agent-cli',
      files: {
        replayResultsJson: 'out/intdeck-agent-cli/replay.results.json',
        replaySummaryMd: 'out/intdeck-agent-cli/replay.summary.md',
      },
    });
    expect(md).toMatch(/## Files/);
    expect(md).toMatch(/replay\.results\.json/);
    expect(md).toMatch(/command:/);
  });
});

