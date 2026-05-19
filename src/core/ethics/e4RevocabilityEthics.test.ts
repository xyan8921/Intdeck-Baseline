import { describe, expect, it } from 'vitest';
import { isE4UndoTokenWellFormed } from './e4RevocabilityEthics';

describe('isE4UndoTokenWellFormed', () => {
  it('accepts undo- prefix with payload', () => {
    expect(isE4UndoTokenWellFormed('undo-173-abc')).toBe(true);
  });

  it('rejects bare undo-', () => {
    expect(isE4UndoTokenWellFormed('undo-')).toBe(false);
  });

  it('rejects wrong prefix', () => {
    expect(isE4UndoTokenWellFormed('revoke-1')).toBe(false);
  });
});
