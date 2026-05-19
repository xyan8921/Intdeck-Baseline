/**
 * Scenario 与 Template 关联
 * 
 * Scenario 是用户意图匹配的场景模板
 * 关联到具体的工作流和所需的 Skill
 * 
 * @see [伦理宪章](../../../ETHICS.md)
 * @see [开发者伦理指南](../../../docs/ethics-guidelines.md)
 */

/**
 * 用户意图匹配的场景模板
 */
export interface Scenario {
  /** Scenario ID，如 "dinosaur-party" */
  id: string;
  /** Scenario 名称 */
  name: string;
  /** 分类：B端或C端 */
  category: 'C端' | 'B端';
  /** 场景描述（可选，用于搜索和展示） */
  scenario?: string;
  /** Prompt 模板，如 "请为{{age}}岁孩子策划{{theme}}派对" */
  promptTemplate: string;
  /** 关联的工作流 ID */
  workflowId: string;
  /** 所需 Skill ID 列表 */
  skills: string[];
  /** 涉及的伦理原则 */
  ethicalPrinciples: ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[];
  /** 示例输出（可选） */
  exampleOutput?: {
    content: string;
    format?: string;
  };
  /** 场景标签（软配置，用于 IntentRouter 与 Core AI） */
  tags?: string[];
}

/**
 * 元模板（MetaTemplate）
 * 用于生成具体 Scenario 的模板
 */
export interface MetaTemplate {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 分类：B端或C端 */
  category: 'C端' | 'B端';
  /** 场景描述 */
  scenario: string;
  /** Prompt 模板 */
  promptTemplate: string;
  /** 示例输出 */
  exampleOutput?: {
    title: string;
    content: string;
    sections?: Array<{
      title: string;
      content: string;
    }>;
  };
  /** 涉及的伦理原则 */
  ethicalPrinciples?: ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[];
}
