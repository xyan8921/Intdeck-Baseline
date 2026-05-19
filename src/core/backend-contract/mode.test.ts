import { describe, expect, it } from 'vitest';
import { resolveBackendContractMode } from './mode';

describe('resolveBackendContractMode', () => {
  it('should fallback to stub', () => {
    expect(resolveBackendContractMode()).toBe('stub');
    expect(resolveBackendContractMode('')).toBe('stub');
    expect(resolveBackendContractMode('unknown')).toBe('stub');
  });

  it('should accept http mode', () => {
    expect(resolveBackendContractMode('http')).toBe('http');
    expect(resolveBackendContractMode('HTTP')).toBe('http');
  });
});

