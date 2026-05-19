/**
 * 内容审核接口定义
 * Stage 0: LocalContentShield 实现（本地敏感词库）
 * Stage 1: AliyunContentShield 实现（阿里云内容安全）
 */

export type ShieldLevel = 'low' | 'medium' | 'high';

export interface ShieldResult {
  passed: boolean;
  reason?: string;
  level?: ShieldLevel;
  /** 与伦理对齐表一致的稳定 ruleId 列表（未命中时通常省略） */
  rulesTriggered?: string[];
}

/**
 * 内容审核接口
 */
export interface IContentShield {
  /**
   * 检查文本内容
   */
  checkText(text: string): Promise<ShieldResult>;

  /**
   * 检查图像内容
   * ⚠️ Stage 0: 不支持真实图像生成，此功能仅为占位
   */
  checkImage(image: File): Promise<ShieldResult>;
}
