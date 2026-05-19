import { describe, expect, it } from 'vitest';
import { scanCoreAiCandidateForCoerciveLanguage } from './e2CoerciveLanguage';

describe('scanCoreAiCandidateForCoerciveLanguage', () => {
  it('returns null for benign text', () => {
    expect(
      scanCoreAiCandidateForCoerciveLanguage(
        { brief: '恐龙派对在周末举行', keywords: [] },
        'kw'
      )
    ).toBeNull();
  });

  it('blocks coercive brief', () => {
    const r = scanCoreAiCandidateForCoerciveLanguage(
      { brief: '请立即付款否则封号', keywords: ['x'] },
      'kw'
    );
    expect(r?.verdict).toBe('block');
  });
});
