import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PolicySnapshot } from '../backend-contract/types';
import { loadPolicyStoreState } from '../backend-contract/policyStore';
import { shouldRequirePolicySnapshotForFinancialExport } from '../../config/policyEvaluation';
import { localEthicsGuard } from '../ethics/LocalEthicsGuard';
import { evaluatePolicy } from './evaluatePolicy';
import {
  FINANCIAL_EXPORT_ETHICS_RULE_ID,
  FINANCIAL_EXPORT_MATRIX_RULE_ID,
  FINANCIAL_EXPORT_POLICY_RULE_ID,
} from './types';

vi.mock('../backend-contract/policyStore', () => ({
  loadPolicyStoreState: vi.fn(),
}));

vi.mock('../../config/policyEvaluation', () => ({
  shouldRequirePolicySnapshotForFinancialExport: vi.fn(),
}));

vi.mock('../ethics/LocalEthicsGuard', () => ({
  localEthicsGuard: {
    checkCandidate: vi.fn(),
  },
}));

const mockLoad = vi.mocked(loadPolicyStoreState);
const mockStrict = vi.mocked(shouldRequirePolicySnapshotForFinancialExport);
const mockEthics = vi.mocked(localEthicsGuard.checkCandidate);

function emptyStore() {
  return {
    current: null as PolicySnapshot | null,
    history: [] as PolicySnapshot[],
    updatedAt: '',
  };
}

describe('evaluatePolicy', () => {
  beforeEach(() => {
    mockLoad.mockReturnValue(emptyStore());
    mockStrict.mockReturnValue(false);
    mockEthics.mockResolvedValue({ verdict: 'allow' });
  });

  it('allows finance + L2', async () => {
    const r = await evaluatePolicy({
      kind: 'financial-export',
      actorType: 'finance',
      dataSensitivity: 'L2',
    });
    expect(r.verdict).toBe('allow');
    if (r.verdict !== 'allow') throw new Error('expected allow');
    expect(r.ruleId).toBe(FINANCIAL_EXPORT_MATRIX_RULE_ID);
  });

  it('denies operator + L3 with stable code', async () => {
    const r = await evaluatePolicy({
      kind: 'financial-export',
      actorType: 'operator',
      dataSensitivity: 'L3',
    });
    expect(r.verdict).toBe('deny');
    if (r.verdict !== 'deny') throw new Error('expected deny');
    expect(r.code).toBe('EXPORT_DENIED_ROLE_SENSITIVITY');
    expect(r.ruleId).toBe(FINANCIAL_EXPORT_MATRIX_RULE_ID);
  });

  it('denies when policy snapshot disables financial export', async () => {
    const snap: PolicySnapshot = {
      schemaVersion: 1,
      version: 'test-off',
      publishedAt: new Date().toISOString(),
      flags: { enableFinancialExport: false },
      thresholds: {},
      weights: {},
    };
    mockLoad.mockReturnValue({
      current: snap,
      history: [],
      updatedAt: '',
    });
    const r = await evaluatePolicy({
      kind: 'financial-export',
      actorType: 'finance',
      dataSensitivity: 'L2',
    });
    expect(r.verdict).toBe('deny');
    if (r.verdict !== 'deny') throw new Error('expected deny');
    expect(r.ruleId).toBe(FINANCIAL_EXPORT_POLICY_RULE_ID);
    expect(r.code).toBe('EXPORT_DENIED_POLICY_DISABLED');
    expect(r.policyVersion).toBe('test-off');
  });

  it('denies when strict mode requires snapshot but none is loaded', async () => {
    mockStrict.mockReturnValue(true);
    mockLoad.mockReturnValue(emptyStore());
    const r = await evaluatePolicy({
      kind: 'financial-export',
      actorType: 'finance',
      dataSensitivity: 'L2',
    });
    expect(r.verdict).toBe('deny');
    if (r.verdict !== 'deny') throw new Error('expected deny');
    expect(r.ruleId).toBe(FINANCIAL_EXPORT_POLICY_RULE_ID);
    expect(r.code).toBe('EXPORT_DENIED_POLICY_UNAVAILABLE');
  });

  it('denies when ethics guard blocks', async () => {
    mockEthics.mockResolvedValue({ verdict: 'block', reason: 'blocked by ethics test' });
    const r = await evaluatePolicy({
      kind: 'financial-export',
      actorType: 'finance',
      dataSensitivity: 'L2',
    });
    expect(r.verdict).toBe('deny');
    if (r.verdict !== 'deny') throw new Error('expected deny');
    expect(r.ruleId).toBe(FINANCIAL_EXPORT_ETHICS_RULE_ID);
    expect(r.code).toBe('EXPORT_DENIED_ETHICS');
    expect(r.reason).toContain('blocked');
  });
});
