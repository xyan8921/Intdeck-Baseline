/**
 * 不 mock LocalEthicsGuard：验证 evaluatePolicy 与真实伦理规则（财务导出）串联。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPolicyStoreState } from '../backend-contract/policyStore';
import { shouldRequirePolicySnapshotForFinancialExport } from '../../config/policyEvaluation';
import {
  FINANCIAL_EXPORT_ETHICS_RULE_ID,
  FINANCIAL_EXPORT_MATRIX_RULE_ID,
} from './types';
import { evaluatePolicy } from './evaluatePolicy';

vi.mock('../backend-contract/policyStore', () => ({
  loadPolicyStoreState: vi.fn(),
}));

vi.mock('../../config/policyEvaluation', () => ({
  shouldRequirePolicySnapshotForFinancialExport: vi.fn(),
}));

const mockLoad = vi.mocked(loadPolicyStoreState);
const mockStrict = vi.mocked(shouldRequirePolicySnapshotForFinancialExport);

describe('evaluatePolicy + real LocalEthicsGuard', () => {
  beforeEach(() => {
    mockStrict.mockReturnValue(false);
    mockLoad.mockReturnValue({
      current: null,
      history: [],
      updatedAt: '',
    });
  });

  it('allows audit + L4 after ethics screen', async () => {
    const r = await evaluatePolicy({
      kind: 'financial-export',
      actorType: 'audit',
      dataSensitivity: 'L4',
    });
    expect(r.verdict).toBe('allow');
    expect(r.ruleId).toBe(FINANCIAL_EXPORT_MATRIX_RULE_ID);
  });

  it('blocks finance + L4 at ethics before matrix', async () => {
    const r = await evaluatePolicy({
      kind: 'financial-export',
      actorType: 'finance',
      dataSensitivity: 'L4',
    });
    expect(r.verdict).toBe('deny');
    if (r.verdict !== 'deny') throw new Error('expected deny');
    expect(r.ruleId).toBe(FINANCIAL_EXPORT_ETHICS_RULE_ID);
    expect(r.code).toBe('EXPORT_DENIED_ETHICS');
  });

  it('denies operator + L3 at ethics before matrix', async () => {
    const r = await evaluatePolicy({
      kind: 'financial-export',
      actorType: 'operator',
      dataSensitivity: 'L3',
    });
    expect(r.verdict).toBe('deny');
    if (r.verdict !== 'deny') throw new Error('expected deny');
    expect(r.ruleId).toBe(FINANCIAL_EXPORT_ETHICS_RULE_ID);
    expect(r.code).toBe('EXPORT_DENIED_ETHICS');
  });

  it('allows operator + L2 after ethics and matrix', async () => {
    const r = await evaluatePolicy({
      kind: 'financial-export',
      actorType: 'operator',
      dataSensitivity: 'L2',
    });
    expect(r.verdict).toBe('allow');
    expect(r.ruleId).toBe(FINANCIAL_EXPORT_MATRIX_RULE_ID);
  });
});
