/**
 * Skill 抽象模型
 * Skill 是 Intdone 智能体的基本能力单元
 * 
 * @see [伦理宪章](../../../ETHICS.md)
 * @see [开发者伦理指南](../../../docs/ethics-guidelines.md)
 */

import { SystemMeta } from '../system/types';

/**
 * Skill 类型
 */
export type SkillType =
  | 'text' // 文本生成
  | 'image' // 图像生成
  | 'pdf' // PDF 生成
  | 'search' // 本地/模拟搜索
  | 'payment' // 支付处理
  | 'fallback' // 降级处理
  | 'guidance'; // 用户引导

/**
 * Skill 元数据
 */
export interface SkillMetadata {
  /** Skill 名称 */
  name: string;
  /** Skill 描述 */
  description: string;
  /** 置信度（0–1），E3 要求 */
  confidence?: number;
  /** 是否需要网络（Stage 0 应为 false） */
  requiresNetwork?: boolean;
  /** 涉及的伦理原则 */
  ethicalPrinciples: ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[];
}

/**
 * Skill 输入（通用格式）
 */
export type SkillInput = Record<string, unknown>;

/**
 * Skill 输出
 */
export interface SkillOutput {
  /** 生成结果（string / Blob / URL） */
  content: unknown;
  /** 内容格式，如 "text/markdown", "image/png", "application/pdf" */
  format: string;
  /** 输出元数据 */
  metadata: {
    /** Skill ID */
    skillId: string;
    /** 时间戳 */
    timestamp: number;
    /** 置信度（E3 要求） */
    confidence?: number;
    /** 免责声明（E1/E3 要求：高风险领域） */
    disclaimer?: string;
    /** 可选：是否触发降级策略 */
    fallbackApplied?: boolean;
    /** 可选：降级类型（skip/use-cache/simplified） */
    fallbackType?: string;
    /** 可选：发生降级的步骤 ID */
    fallbackStepId?: string;
    /** 可选扩展字段 */
    [key: string]: unknown;
  };
}

/**
 * 所有 Skill 必须实现的最小接口
 */
export interface Skill {
  /** Skill 唯一标识符，如 "text-generation", "image-render" */
  id: string;
  /** Skill 类型 */
  type: SkillType;
  /** Skill 元数据 */
  metadata: SkillMetadata;
  /**
   * 执行 Skill
   * @param input Skill 输入
   * @param meta 系统元信息
   * @returns Skill 输出
   */
  execute(input: SkillInput, meta: SystemMeta): Promise<SkillOutput>;
}
