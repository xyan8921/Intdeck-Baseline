import { describe, expect, it } from 'vitest';
import { loadIntdeckAgentRuntimeManifest } from './loadIntdeckAgentConfig';

describe('loadIntdeckAgentConfig', () => {
  it('loads default file from repo and produces stable sha256 shape', async () => {
    const { manifest, file } = await loadIntdeckAgentRuntimeManifest({
      cwd: process.cwd(),
    });
    expect(file.schemaVersion).toBe(1);
    expect(file.capabilities.llm).toBe(false);
    expect(file.capabilities.networkEgress).toBe('deny');
    expect(manifest.loadedFrom).toMatch(/intdeck-agent\.default\.json$/);
    expect(manifest.configSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.capabilities).toEqual(file.capabilities);
  });

  it('rejects invalid networkEgress', async () => {
    const bad = JSON.stringify({
      schemaVersion: 1,
      capabilities: { llm: false, thirdPartyAPI: false, networkEgress: 'open' },
    });
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'intdeck-cfg-'));
    const p = join(dir, 'bad.json');
    writeFileSync(p, bad, 'utf8');
    await expect(loadIntdeckAgentRuntimeManifest({ configPath: p, cwd: process.cwd() })).rejects.toThrow(
      /networkEgress/
    );
    rmSync(dir, { recursive: true, force: true });
  });
});
