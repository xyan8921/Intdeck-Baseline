/* eslint-disable @typescript-eslint/no-explicit-any -- test-only fetch stubs */
import { describe, expect, it, vi } from 'vitest';
import { TextGenerationSkill } from './TextGenerationSkill';
import { createSystemMeta } from '@/core/system/types';
import { buildGenericPlanningPrompt } from '@/core/execution/buildGenericPrompt';

describe('TextGenerationSkill generic-keyword theme index (integration)', () => {
  it('loads themed content and exposes theme metadata when index hit', async () => {
    const skill = new TextGenerationSkill();
    const meta = createSystemMeta({ stage: 'stage0' });

    const prompt = buildGenericPlanningPrompt({
      topLevelCategory: 'Celebration',
      subCategoryId: 'social-gathering',
      entries: { goal: '恐龙派对', people: '12', budget: '2000' },
      seed: 'theme-index',
    });

    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/mock-responses/event-planning/themes/index.json') {
        return {
          ok: true,
          json: async () => ({
            themes: [
              {
                id: 'dinosaur-party',
                title: '恐龙主题生日派对',
                keywords: ['恐龙', 'dinosaur', '派对'],
                shard: 'shard-1.json',
              },
            ],
          }),
        } as any;
      }
      if (url === '/mock-responses/event-planning/themes/shard-1.json') {
        return {
          ok: true,
          json: async () => ({
            themes: [
              {
                id: 'dinosaur-party',
                content: '# 主题命中：恐龙派对\n\n这里是主题库内容（standard）。\n',
                metadata: { from: 'unit-test' },
              },
            ],
          }),
        } as any;
      }
      throw new Error(`unexpected fetch url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const out = await skill.execute({ prompt, templateId: 'generic-keyword' }, meta);
    expect(typeof out.content).toBe('string');
    expect(out.content).toContain('主题命中：恐龙派对');
    expect(out.metadata?.themeId).toBe('dinosaur-party');
    expect(out.metadata?.themeTitle).toBe('恐龙主题生日派对');
    expect(out.metadata?.source).toBe('event-theme-index');
    expect(out.metadata?.outputTier).toBe('standard');
  });
});

