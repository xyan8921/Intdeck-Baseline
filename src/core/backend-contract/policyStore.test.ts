import { describe, expect, it } from 'vitest';
import {
  loadPolicyStoreState,
  publishLocalPolicyDraft,
  rollbackLocalPolicy,
} from './policyStore';

describe('policyStore', () => {
  it('should publish local policy draft', () => {
    const policy = publishLocalPolicyDraft({
      flags: { enableDevWorkspace: true },
      thresholds: { riskBudget: 2 },
    });
    expect(policy.version.startsWith('local-')).toBe(true);
    expect(policy.flags.enableDevWorkspace).toBe(true);
    expect(policy.thresholds.riskBudget).toBe(2);
  });

  it('should rollback to previous policy when history exists', () => {
    const before = loadPolicyStoreState().current;
    publishLocalPolicyDraft({ flags: { beta: true } });
    const rolled = rollbackLocalPolicy();
    if (before) {
      expect(rolled?.version).toBe(before.version);
    } else {
      expect(rolled).not.toBeNull();
    }
  });
});

