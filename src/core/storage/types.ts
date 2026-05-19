/**
 * 数据访问层接口定义
 * Stage 0: LocalDAO 实现（IndexedDB）
 * Stage 1: CloudDAO 实现（PostgreSQL via API）
 */

export type IntentTopLevelCategory =
  | 'Celebration'
  | 'ProblemSolving'
  | 'Creation'
  | 'Learning';

export type IntentValueAttribution = 'personal' | 'organization' | 'ambiguous';

export type IntentDataSovereignty = 'user' | 'org' | 'shared';

export interface IntentMetaSnapshot {
  /** 顶层意图大类（四大类之一） */
  topLevelCategory: IntentTopLevelCategory;
  /** 子类 ID（如: 儿童生日派对 / 小团队团建 / 旅行规划 等） */
  subCategoryId: string;
  /** B/C 端属性以及价值归属、数据权属 */
  userSide: 'B端' | 'C端';
  valueAttribution: IntentValueAttribution;
  dataSovereignty: IntentDataSovereignty;
  /** 风险等级（后续 HDGP / Ethics 可用） */
  riskLevel?: 'low' | 'medium' | 'high';
}

/** 关键词束占位（Phase 2 全量数据结构前先存 Core AI 输出与表单衍生） */
export interface KeywordBundleV0 {
  schemaVersion: '0';
  entries: Array<{
    key: string;
    value: string;
    source?: 'core-ai' | 'form' | 'user';
  }>;
}

export interface Intent {
  id: string;
  /** 存储层记录版本（软迁移，见 intentNormalize） */
  recordVersion?: number;
  /** 用户原始自然语言或模板渲染后的内容 */
  content: string;
  /** 简化保留旧字段便于兼容，语义同 userSide */
  category: 'B端' | 'C端';
  /** Meta 快照：符合 META_INTENT_MODEL_v1 的结构化信息（可含 aiKeywords、keywordBundle、budget* 等） */
  meta?: IntentMetaSnapshot & {
    keywordBundle?: KeywordBundleV0;
    aiKeywords?: string[];
    budget?: number;
    budgetCurrency?: string;
    budgetScope?: string;
    budgetHeadcount?: number;
  } & Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetaTemplate {
  id: string;
  name: string;
  category: 'B端' | 'C端';
  scenario: string;
  promptTemplate: string;
  exampleOutput?: unknown;
}

export interface Solution {
  id: string;
  intentId: string;
  /** 方案标题（通常为模板名称） */
  title: string;
  content: string;
  /** 关联的 Scenario ID，用于历史记录恢复展示 */
  scenarioId?: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 数据访问对象接口
 */
export interface IDAO {
  // Intent 相关
  saveIntent(intent: Intent): Promise<void>;
  loadIntents(): Promise<Intent[]>;
  getIntent(id: string): Promise<Intent | null>;
  deleteIntent(id: string): Promise<void>;

  // Template 相关
  saveTemplate(template: MetaTemplate): Promise<void>;
  loadTemplates(): Promise<MetaTemplate[]>;
  getTemplate(id: string): Promise<MetaTemplate | null>;

  // Solution 相关
  saveSolution(solution: Solution): Promise<void>;
  loadSolutions(): Promise<Solution[]>;
  getSolution(id: string): Promise<Solution | null>;
  deleteSolution(id: string): Promise<void>;
}
