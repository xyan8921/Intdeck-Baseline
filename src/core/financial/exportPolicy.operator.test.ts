import { describe, expect, it } from 'vitest';
import { validateFinancialExportPermission } from './exportPolicy';

describe('export policy operator sensitivity', () => {
  it('allows L1/L2', () => {
    expect(validateFinancialExportPermission({ actorType: 'operator', dataSensitivity: 'L1' }).allowed).toBe(true);
    expect(validateFinancialExportPermission({ actorType: 'operator', dataSensitivity: 'L2' }).allowed).toBe(true);
  });

  it('denies L3/L4', () => {
    const d3 = validateFinancialExportPermission({ actorType: 'operator', dataSensitivity: 'L3' });
    expect(d3.allowed).toBe(false);
    if (!d3.allowed) expect(d3.code).toBe('EXPORT_DENIED_ROLE_SENSITIVITY');
    const d4 = validateFinancialExportPermission({ actorType: 'operator', dataSensitivity: 'L4' });
    expect(d4.allowed).toBe(false);
    if (!d4.allowed) expect(d4.code).toBe('EXPORT_DENIED_ROLE_SENSITIVITY');
  });
});

