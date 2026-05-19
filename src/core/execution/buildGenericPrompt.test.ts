import { describe, expect, it } from 'vitest';
import { buildGenericPlanningPrompt } from './buildGenericPrompt';

describe('buildGenericPlanningPrompt', () => {
  it('should include seed line when provided', () => {
    const prompt = buildGenericPlanningPrompt({
      topLevelCategory: 'Learning',
      subCategoryId: 'generic',
      entries: { goal: '通过考试', budget: '2000' },
      outputTier: 'standard',
      seed: 42,
    });
    expect(prompt).toContain('意图大类：Learning');
    expect(prompt).toContain('子类 ID：generic');
    expect(prompt).toContain('seed：42');
  });

  it('should include pro tier line when outputTier=pro', () => {
    const prompt = buildGenericPlanningPrompt({
      topLevelCategory: 'ProblemSolving',
      subCategoryId: 'generic',
      entries: {},
      outputTier: 'pro',
    });
    expect(prompt).toContain('内容档位：pro');
  });
});

