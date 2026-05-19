import { describe, expect, it } from 'vitest';
import { normalizePolicySnapshot } from './policyCompat';

describe('policyCompat', () => {
  it('should normalize missing schemaVersion to v1 with warning', () => {
    const out = normalizePolicySnapshot({
      version: 'v0',
      publishedAt: new Date().toISOString(),
      flags: {},
      thresholds: {},
      weights: {},
    });
    expect(out.policy?.schemaVersion).toBe(1);
    expect(out.issues.length).toBeGreaterThan(0);
  });
});

