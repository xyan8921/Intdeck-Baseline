import type { IntentTopLevelCategory } from '@/core/storage/types';

/** 执行路径（可观测 / 审计） */
export type ExecutionPathKind = 'template' | 'keyword-generic';

/** 统一请求描述（facade 分流用，逐步与引擎对齐） */
export type ExecutionRequest =
  | {
      path: 'template';
      templateId: string;
      params: Record<string, unknown>;
    }
  | {
      path: 'keyword-generic';
      topLevelCategory: IntentTopLevelCategory;
      subCategoryId: string;
      entries: Record<string, string>;
      /** 与主题库 standard/pro 对齐；未传视为 standard */
      outputTier?: 'standard' | 'pro';
      /**
       * 可选：受控随机 seed，用于“可复现 + 低重复”的文案选择。
       * - 不传：由系统根据输入参数稳定派生
       * - 传入：在稳定派生的基础上混入该 seed
       */
      seed?: string | number;
    };
