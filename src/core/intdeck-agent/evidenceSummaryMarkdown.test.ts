import { describe, expect, it } from 'vitest';
import { renderEvidenceSummaryMarkdownV1 } from './evidenceSummaryMarkdown';
import type { EvidenceManifestV1 } from './evidenceManifest';

function makeManifest(): EvidenceManifestV1 {
  return {
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    outDir: 'out/intdeck-agent-cli',
    command: 'npm run intdeck:agent -- all',
    repo: { commitSha: 'a'.repeat(64), branch: 'main', isDirty: false },
    runtime: {
      nodeVersion: 'v20.0.0',
      platform: 'win32',
      arch: 'x64',
      cwd: '/tmp',
      npmUserAgent: null,
    },
    config: { configPath: null, configSha256: 'b'.repeat(64) },
    inputs: [],
    outputs: [{ path: 'out/x.json', sha256Hex: 'c'.repeat(64), bytes: 100 }],
    notes: ['test note'],
  };
}

describe('renderEvidenceSummaryMarkdownV1', () => {
  it('包含门禁与回放摘要', () => {
    const md = renderEvidenceSummaryMarkdownV1({
      manifest: makeManifest(),
      gates: {
        schemaVersion: 1,
        overallPassed: true,
        results: [{ gate: 'lint', passed: true, durationMs: 100 }],
      },
      replaySummary: {
        ok: true,
        itemsReplayed: 1,
        blocked: false,
        inputSource: 'disk',
        exportPackagePath: 'out/intdeck-agent-cli/experience.export.json',
      },
    });
    expect(md).toMatch(/证据包摘要/);
    expect(md).toMatch(/门禁/);
    expect(md).toMatch(/回放/);
    expect(md).toMatch(/交付建议/);
  });
});
