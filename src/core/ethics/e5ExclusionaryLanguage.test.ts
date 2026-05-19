import { describe, expect, it } from 'vitest';
import {
  scanCoreAiCandidateForExclusionaryLanguage,
  scanPlainTextForExclusionaryLanguage,
} from './e5ExclusionaryLanguage';

describe('scanCoreAiCandidateForExclusionaryLanguage', () => {
  it('returns null for benign text', () => {
    expect(
      scanCoreAiCandidateForExclusionaryLanguage(
        { brief: '恐龙派对在周末举行', keywords: [] },
        'kw'
      )
    ).toBeNull();
  });

  it('blocks slur-like brief', () => {
    const r = scanCoreAiCandidateForExclusionaryLanguage(
      { brief: '这是脑残方案', keywords: ['x'] },
      'kw'
    );
    expect(r?.verdict).toBe('block');
  });
});

describe('scanPlainTextForExclusionaryLanguage', () => {
  it('returns null for empty or safe text', () => {
    expect(scanPlainTextForExclusionaryLanguage('')).toBeNull();
    expect(scanPlainTextForExclusionaryLanguage('正常活动策划')).toBeNull();
  });

  it('returns hint when pattern matches', () => {
    expect(scanPlainTextForExclusionaryLanguage('x弱智x')?.hint).toBe('zh:slur-mental');
  });
});
