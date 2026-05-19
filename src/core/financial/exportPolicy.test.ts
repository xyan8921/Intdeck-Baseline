import { describe, expect, it } from 'vitest';
import { validateFinancialExportPermission } from './exportPolicy';

describe('validateFinancialExportPermission', () => {
  it('should allow operator for L2', () => {
    const res = validateFinancialExportPermission({ actorType: 'operator', dataSensitivity: 'L2' });
    expect(res.allowed).toBe(true);
  });

  it('should deny operator for L3', () => {
    const res = validateFinancialExportPermission({ actorType: 'operator', dataSensitivity: 'L3' });
    expect(res.allowed).toBe(false);
    if (res.allowed) throw new Error('expected denied');
    expect(res.code).toBe('EXPORT_DENIED_ROLE_SENSITIVITY');
    expect(res.reason).toContain('EXPORT_DENIED');
  });
});

