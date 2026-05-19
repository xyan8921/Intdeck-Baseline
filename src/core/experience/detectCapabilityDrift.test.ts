import { describe, expect, it } from 'vitest';
import { detectCapabilityDrift, hasCapabilityRegression } from './detectCapabilityDrift';
import type { IntdeckAgentRuntimeManifestV1 } from './experienceTypes';

function makeManifest(
  caps: Partial<IntdeckAgentRuntimeManifestV1['capabilities']>
): IntdeckAgentRuntimeManifestV1 {
  return {
    schemaVersion: 1,
    loadedFrom: 'test',
    configSha256: 'a'.repeat(64),
    capabilities: {
      llm: false,
      thirdPartyAPI: false,
      networkEgress: 'deny',
      ...caps,
    },
  };
}

describe('detectCapabilityDrift — networkEgress', () => {
  it('allowlist→deny = regression', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ networkEgress: 'allowlist' }),
      makeManifest({ networkEgress: 'deny' })
    );
    expect(drifts).toHaveLength(1);
    expect(drifts[0].field).toBe('networkEgress');
    expect(drifts[0].severity).toBe('regression');
    expect(drifts[0].stored).toBe('allowlist');
    expect(drifts[0].current).toBe('deny');
  });

  it('deny→allowlist = upgrade', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ networkEgress: 'deny' }),
      makeManifest({ networkEgress: 'allowlist' })
    );
    expect(drifts).toHaveLength(1);
    expect(drifts[0].severity).toBe('upgrade');
  });

  it('deny→deny = neutral（不进入结果）', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ networkEgress: 'deny' }),
      makeManifest({ networkEgress: 'deny' })
    );
    const net = drifts.find((d) => d.field === 'networkEgress');
    expect(net).toBeUndefined();
  });
});

describe('detectCapabilityDrift — thirdPartyAPI', () => {
  it('true→false = regression', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ thirdPartyAPI: true }),
      makeManifest({ thirdPartyAPI: false })
    );
    const d = drifts.find((x) => x.field === 'thirdPartyAPI');
    expect(d?.severity).toBe('regression');
  });

  it('false→true = upgrade', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ thirdPartyAPI: false }),
      makeManifest({ thirdPartyAPI: true })
    );
    const d = drifts.find((x) => x.field === 'thirdPartyAPI');
    expect(d?.severity).toBe('upgrade');
  });

  it('同值 → 不进入结果', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ thirdPartyAPI: false }),
      makeManifest({ thirdPartyAPI: false })
    );
    expect(drifts.find((d) => d.field === 'thirdPartyAPI')).toBeUndefined();
  });
});

describe('detectCapabilityDrift — llm', () => {
  it('true→false = regression', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ llm: true }),
      makeManifest({ llm: false })
    );
    const d = drifts.find((x) => x.field === 'llm');
    expect(d?.severity).toBe('regression');
  });

  it('false→true = upgrade', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ llm: false }),
      makeManifest({ llm: true })
    );
    const d = drifts.find((x) => x.field === 'llm');
    expect(d?.severity).toBe('upgrade');
  });
});

describe('detectCapabilityDrift — 综合', () => {
  it('全相同 → 空列表', () => {
    const m = makeManifest({ networkEgress: 'allowlist', thirdPartyAPI: true, llm: true });
    expect(detectCapabilityDrift(m, m)).toHaveLength(0);
  });

  it('多字段同时漂移', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ networkEgress: 'allowlist', thirdPartyAPI: true, llm: true }),
      makeManifest({ networkEgress: 'deny', thirdPartyAPI: false, llm: false })
    );
    expect(drifts).toHaveLength(3);
    expect(drifts.every((d) => d.severity === 'regression')).toBe(true);
  });

  it('部分 regression + 部分 upgrade', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ networkEgress: 'allowlist', thirdPartyAPI: false }),
      makeManifest({ networkEgress: 'deny', thirdPartyAPI: true })
    );
    const net = drifts.find((d) => d.field === 'networkEgress');
    const third = drifts.find((d) => d.field === 'thirdPartyAPI');
    expect(net?.severity).toBe('regression');
    expect(third?.severity).toBe('upgrade');
  });
});

describe('hasCapabilityRegression', () => {
  it('含 regression → true', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ networkEgress: 'allowlist' }),
      makeManifest({ networkEgress: 'deny' })
    );
    expect(hasCapabilityRegression(drifts)).toBe(true);
  });

  it('仅 upgrade → false', () => {
    const drifts = detectCapabilityDrift(
      makeManifest({ networkEgress: 'deny' }),
      makeManifest({ networkEgress: 'allowlist' })
    );
    expect(hasCapabilityRegression(drifts)).toBe(false);
  });

  it('空列表 → false', () => {
    expect(hasCapabilityRegression([])).toBe(false);
  });
});
