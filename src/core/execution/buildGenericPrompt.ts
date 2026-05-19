import type { IntentTopLevelCategory } from '@/core/storage/types';

export interface GenericKeywordInput {
  topLevelCategory: IntentTopLevelCategory;
  subCategoryId: string;
  /** 来自表单或关键词束的键值 */
  entries: Record<string, string>;
  /** 主题正文档位：standard 为分片内短版；pro 可加载 contentPro / contentProPath */
  outputTier?: 'standard' | 'pro';
  /** 可选：受控随机 seed（用于可复现的多样化措辞） */
  seed?: string | number;
}

/**
 * 拼装进入 text-generation 的提示（非 LLM：由 Skill 侧 Mock/模板消费）
 */
export function buildGenericPlanningPrompt(input: GenericKeywordInput): string {
  const lines = Object.entries(input.entries)
    .filter(([, v]) => v.trim() !== '')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const tierLine =
    input.outputTier === 'pro' ? '内容档位：pro' : '';

  const seedLine =
    input.seed === undefined || input.seed === null || String(input.seed).trim() === ''
      ? ''
      : `seed：${String(input.seed).trim()}`;

  const categoryHint =
    input.topLevelCategory === 'Celebration'
      ? '输出风格：偏活动策划/体验设计，强调流程、物料、分工与备选方案。'
      : input.topLevelCategory === 'Learning'
        ? '输出风格：偏学习计划/节奏管理，强调里程碑、复盘机制与最小可执行单元。'
        : '输出风格：偏问题闭环/排障计划，强调边界、验证、回退与风险控制。';

  return [
    '[Intdone · 关键词通用规划 · local-first]',
    `意图大类：${input.topLevelCategory}`,
    `子类 ID：${input.subCategoryId}`,
    tierLine,
    seedLine,
    '已知参数：',
    lines || '（无）',
    '',
    categoryHint,
    '请基于以上信息输出可执行的检查清单与注意事项（Markdown）。',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
