import { describe, expect, it } from 'vitest';
import { TextGenerationSkill } from './TextGenerationSkill';
import { createSystemMeta } from '@/core/system/types';
import { buildGenericPlanningPrompt } from '@/core/execution/buildGenericPrompt';

describe('TextGenerationSkill B-side keyword flow', () => {
  it('should generate readable markdown for B-side forum/market inputs', async () => {
    const skill = new TextGenerationSkill();
    const meta = createSystemMeta({ stage: 'stage0' });
    const prompt = buildGenericPlanningPrompt({
      topLevelCategory: 'Celebration',
      subCategoryId: 'corporate-anniversary',
      entries: {
        goal: '组织一场技术论坛并包含赞助商展位',
        orgSize: '51-200',
        role: 'pm',
        constraintSource: 'customer',
        complianceNeed: 'high',
      },
      seed: 'b-side-forum',
    });

    const out = await skill.execute({ prompt, templateId: 'generic-keyword' }, meta);
    expect(typeof out.content).toBe('string');
    expect(out.content).toContain('关键词驱动执行方案');
    expect(out.content).toContain('建议执行步骤');
  });
});

