import { describe, expect, it } from 'vitest';
import { exportPreflightCheck } from './exportPreflight';

describe('exportPreflightCheck', () => {
  it('rejects when no visible rows', () => {
    const r = exportPreflightCheck({ visibleCount: 0, selectedCount: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch('无可导出');
  });

  it('rejects when nothing selected', () => {
    const r = exportPreflightCheck({ visibleCount: 3, selectedCount: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch('至少勾选');
  });

  it('rejects when declarations missing', () => {
    const r = exportPreflightCheck({
      visibleCount: 3,
      selectedCount: 1,
      declarationsOk: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch('purpose/scope');
  });

  it('requires confirm when mixed risk + unfiltered', () => {
    const r = exportPreflightCheck({
      visibleCount: 3,
      selectedCount: 2,
      mixedRisk: true,
      riskConfirmOnlyWhenUnfiltered: true,
      isUnfiltered: true,
      mixedRiskConfirmMessage: 'MIXED',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.confirm?.message).toBe('MIXED');
    }
  });

  it('does not require confirm when filtered', () => {
    const r = exportPreflightCheck({
      visibleCount: 3,
      selectedCount: 2,
      mixedRisk: true,
      riskConfirmOnlyWhenUnfiltered: true,
      isUnfiltered: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.confirm).toBeUndefined();
    }
  });
});

