/**
 * 工作流（Workflow）引擎规范
 * 
 * @see [伦理宪章](../../../ETHICS.md)
 * @see [开发者伦理指南](../../../docs/ethics-guidelines.md)
 */

/**
 * 降级策略类型
 */
export type FallbackStrategy =
  | { type: 'skip'; description?: string } // 跳过此步骤
  | { type: 'use-cache'; cacheKey: string; description?: string } // 使用缓存
  | { type: 'simplified'; alternativeSkillId: string; description?: string }; // 使用简化方案

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  /** 步骤 ID，如 "generate-text" */
  id: string;
  /** 引用的 Skill ID */
  skillId: string;
  /** 依赖的步骤 id 列表（Stage 2+ DAG 用；Stage 0 可忽略，按 steps 顺序执行） */
  dependsOn?: string[];
  /** 输入模板变量映射（静态字符串替换） */
  inputTemplate: Record<string, string>;
  /**
   * Sprint D DAG 数据流绑定：paramName → 来源步骤输出字段。
   * 优先级高于 inputTemplate 中同名键；未提供时退化为纯静态模板。
   */
  dataFlowMap?: import('./stepDataFlow').WorkflowStepDataFlowMap;
  /** 降级策略（E4 要求：随时保持回退） */
  fallback?: FallbackStrategy;
}

/**
 * 工作流定义
 * 一个完整的用户意图执行流程
 */
export interface Workflow {
  /** 工作流 ID，如 "dinosaur-party-workflow" */
  id: string;
  /** 关联的 Scenario ID */
  scenarioId: string;
  /** 工作流步骤列表 */
  steps: WorkflowStep[];
  /** 工作流元数据 */
  metadata: {
    /** 工作流名称 */
    name: string;
    /** 工作流描述 */
    description: string;
    /** 最终输出格式 */
    outputFormat: 'pdf' | 'html' | 'markdown' | 'json';
    /** 涉及的伦理原则 */
    ethicalPrinciples: ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[];
  };
}

/**
 * 工作流执行状态
 */
export interface WorkflowStatus {
  /** 当前步骤索引（从 0 开始） */
  currentStep: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 当前步骤名称 */
  stepName: string;
  /** 是否完成 */
  isComplete: boolean;
  /** 错误信息（如有） */
  error?: string;
  /** E4：`execute` 失败且已清空撤销栈时为 true，便于观测/ UI */
  stackClearedAfterFailure?: boolean;
}

/**
 * 可交付成果
 * 工作流执行完成后生成的可交付方案
 */
export interface Deliverable {
  /** 内容（Blob 或字符串） */
  content: Blob | string;
  /** 内容格式 */
  format: string;
  /** 元数据 */
  metadata: {
    /** 工作流 ID */
    workflowId: string;
    /** Scenario ID */
    scenarioId: string;
    /** 时间戳 */
    timestamp: number;
    /** 撤销令牌（E4 要求：随时保持回退） */
    undoToken: string;
    /** 可选：主题命中信息（关键词主题库） */
    themeId?: string;
    themeTitle?: string;
    /** 可选扩展字段 */
    [key: string]: unknown;
  };
}
