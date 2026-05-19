import { describe, expect, it } from 'vitest';
import { TextGenerationSkill } from './TextGenerationSkill';
import { createSystemMeta } from '@/core/system/types';
import { buildGenericPlanningPrompt } from '@/core/execution/buildGenericPrompt';

describe('TextGenerationSkill generic-keyword seed', () => {
  it('should be deterministic with same external seed', async () => {
    const skill = new TextGenerationSkill();
    const meta = createSystemMeta({ stage: 'stage0' });
    const prompt = buildGenericPlanningPrompt({
      topLevelCategory: 'Learning',
      subCategoryId: 'generic',
      entries: { goal: '通过考试', deadline: '6周' },
      seed: 'abc',
    });

    const out1 = await skill.execute({ prompt, templateId: 'generic-keyword' }, meta);
    const out2 = await skill.execute({ prompt, templateId: 'generic-keyword' }, meta);
    expect(out1.content).toBe(out2.content);
    expect(out1.content).toContain('externalSeed=abc');
  });

  it('should vary when external seed changes', async () => {
    const skill = new TextGenerationSkill();
    const meta = createSystemMeta({ stage: 'stage0' });
    const promptA = buildGenericPlanningPrompt({
      topLevelCategory: 'Learning',
      subCategoryId: 'generic',
      entries: { goal: '通过考试', deadline: '6周' },
      seed: 'A',
    });
    const promptB = buildGenericPlanningPrompt({
      topLevelCategory: 'Learning',
      subCategoryId: 'generic',
      entries: { goal: '通过考试', deadline: '6周' },
      seed: 'B',
    });

    const outA = await skill.execute({ prompt: promptA, templateId: 'generic-keyword' }, meta);
    const outB = await skill.execute({ prompt: promptB, templateId: 'generic-keyword' }, meta);
    expect(outA.content).not.toBe(outB.content);
  });

  it('should keep stable key sections for generic output', async () => {
    const skill = new TextGenerationSkill();
    const meta = createSystemMeta({ stage: 'stage0' });
    const prompt = buildGenericPlanningPrompt({
      topLevelCategory: 'ProblemSolving',
      subCategoryId: 'resource-allocation',
      entries: { goal: '完成活动执行', budget: '8000', people: '30' },
      seed: 'structure-check',
    });
    const out = await skill.execute({ prompt, templateId: 'generic-keyword' }, meta);
    expect(out.content).toContain('## 目标与约束摘要');
    expect(out.content).toContain('## 建议执行步骤');
    expect(out.content).toContain('## 参数快照');
    expect(out.content).toContain('## 提示');
  });
});

