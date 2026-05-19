import type { UnifiedAuditEventV1 } from '../observability/unifiedAuditSchema';

export type AiCoreOperation =
  | 'clarify'
  | 'plan'
  | 'variation'
  | 'keywords'
  | 'meta-change'
  | 'route-confirm';

export interface ClarifyInput {
  projectId: string;
  userId: string;
  rawDescription: string;
  metaSnapshot: unknown;
  /** 用于加载 core/ai/config（缺省按默认档） */
  templateId?: string;
}

export interface ClarifyQuestion {
  id: string;
  text: string;
  type: 'single_choice' | 'multi_choice' | 'text';
  options?: Array<{ id: string; label: string }>;
}

export interface ClarifyOutput {
  questions: ClarifyQuestion[];
  draftMeta: unknown;
}

export interface PlanInput {
  projectId: string;
  userId: string;
  confirmedMeta: unknown;
  templateId: string;
}

export interface PlanOutput {
  tasks: unknown[];
  milestones: unknown[];
}

export interface VariationInput {
  projectId: string;
  userId: string;
  basePlan: unknown;
  constraints: unknown;
  templateId?: string;
}

export interface VariationOutput {
  variations: unknown[];
}

export interface KeywordInput {
  projectId: string;
  userId: string;
  finalPlan: unknown;
}

export interface KeywordOutput {
  keywords: string[];
  brief: string;
}

export interface EthicsDecision {
  verdict: 'allow' | 'revise' | 'block';
  reason?: string;
  effectiveOutput?: unknown;
  rulesTriggered?: string[];
}

export interface AiCoreLogEntry {
  id: string;
  timestamp: string;
  projectId: string;
  userId: string;
  operation: AiCoreOperation;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  metaSnapshot: unknown;
  ethicsDecision?: EthicsDecision;
  /** 与 `ethicsDecision` 同源，供跨路径对齐与导出 */
  auditEventV1?: UnifiedAuditEventV1;
}

export interface AiCoreService {
  clarifyIntent(input: ClarifyInput): Promise<ClarifyOutput>;
  generateInitialPlan(input: PlanInput): Promise<PlanOutput>;
  suggestVariations(input: VariationInput): Promise<VariationOutput>;
  extractKeywords(input: KeywordInput): Promise<KeywordOutput>;
}

