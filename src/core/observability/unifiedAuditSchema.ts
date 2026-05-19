/**
 * 统一 audit schema（草案）：Shield / Core AI / 出站 / E4 / 财务导出 / E5 静态路径上的
 * `rulesTriggered` 共用同一套 envelope，便于 Dev 导出与后续服务端对齐。
 */

export const UNIFIED_AUDIT_SCHEMA_VERSION = 1 as const;

export type AuditVerdict = 'allow' | 'revise' | 'block' | 'unknown';

/** 观测面：与 ruleId 前缀一一对应，见 `inferAuditSurfaceFromRuleId` */
export type AuditSurface =
  | 'content_shield'
  | 'core_ai'
  | 'outbound'
  | 'workflow'
  | 'financial_export'
  | 'intent_static'
  | 'unknown';

export interface UnifiedAuditEventV1 {
  schemaVersion: typeof UNIFIED_AUDIT_SCHEMA_VERSION;
  surface: AuditSurface;
  /** 每条 ruleId 的推断面；多条规则跨面时 `surface` 为 `unknown` */
  surfacesByRule?: Array<{ ruleId: string; surface: AuditSurface }>;
  verdict: AuditVerdict;
  rulesTriggered: string[];
  reason?: string;
  correlation?: Record<string, unknown>;
}

export function inferAuditSurfaceFromRuleId(ruleId: string): AuditSurface {
  if (!ruleId || typeof ruleId !== 'string') return 'unknown';
  const r = ruleId.trim();
  if (r.startsWith('ethics.e1.shield.')) return 'content_shield';
  if (
    r.startsWith('ethics.e2.core-ai.') ||
    r.startsWith('ethics.e3.core-ai.') ||
    r.startsWith('ethics.e5.core-ai.')
  ) {
    return 'core_ai';
  }
  if (r.startsWith('ethics.e2.outbound.') || r.startsWith('ethics.e3.outbound.')) {
    return 'outbound';
  }
  if (r.startsWith('ethics.e4.')) return 'workflow';
  if (r.startsWith('ethics.e3.financial-export.') || r.startsWith('ethics.e6.financial-export.')) {
    return 'financial_export';
  }
  if (
    r.startsWith('ethics.e5.preset-template.') ||
    r.startsWith('ethics.e5.keyword-bundle.') ||
    r.startsWith('ethics.e5.intent-route.')
  ) {
    return 'intent_static';
  }
  return 'unknown';
}

export function normalizeRulesTriggered(rules: string[] | undefined | null): string[] {
  if (!rules || !Array.isArray(rules)) return [];
  return [...new Set(rules.map((x) => String(x).trim()).filter(Boolean))];
}

/** 纯 Ethics 决策 → envelope（出站 / E4 / 财务伦理等经 `LocalEthicsGuard` 的路径）。 */
export function buildUnifiedAuditFromEthicsDecision(
  decision: { verdict: 'allow' | 'revise' | 'block'; reason?: string; rulesTriggered?: string[] },
  correlation?: Record<string, unknown>
): UnifiedAuditEventV1 {
  return buildUnifiedAuditEventV1({
    rulesTriggered: decision.rulesTriggered ?? [],
    verdict: decision.verdict,
    reason: decision.reason,
    correlation,
  });
}

/** Core AI 单步：先 Shield（可选）再 Ethics，规则合并后生成统一 envelope。 */
export function buildUnifiedAuditForCoreAiStep(input: {
  ethics: { verdict: 'allow' | 'revise' | 'block'; reason?: string; rulesTriggered?: string[] };
  /** 先于 Ethics 执行的规则（如 `localContentShield.checkText`） */
  additionalRules?: string[];
  correlation?: Record<string, unknown>;
}): UnifiedAuditEventV1 {
  const merged = normalizeRulesTriggered([
    ...(input.additionalRules ?? []),
    ...(input.ethics.rulesTriggered ?? []),
  ]);
  return buildUnifiedAuditEventV1({
    rulesTriggered: merged,
    verdict: input.ethics.verdict,
    reason: input.ethics.reason,
    correlation: input.correlation,
  });
}

export function buildUnifiedAuditEventV1(input: {
  rulesTriggered: string[];
  verdict: AuditVerdict;
  reason?: string;
  correlation?: Record<string, unknown>;
  /** `rulesTriggered` 为空或未识别时，由调用方声明观测面（如 pass-screen） */
  surfaceHint?: AuditSurface;
}): UnifiedAuditEventV1 {
  const rulesTriggered = normalizeRulesTriggered(input.rulesTriggered);
  const surfacesByRule = rulesTriggered.map((ruleId) => ({
    ruleId,
    surface: inferAuditSurfaceFromRuleId(ruleId),
  }));
  const inferred = surfacesByRule.map((x) => x.surface);
  const nonUnknown = [...new Set(inferred.filter((s) => s !== 'unknown'))];

  let surface: AuditSurface;
  if (rulesTriggered.length === 0) {
    surface = input.surfaceHint ?? 'unknown';
  } else if (nonUnknown.length === 1) {
    surface = nonUnknown[0];
  } else if (nonUnknown.length > 1) {
    surface = 'unknown';
  } else {
    surface = input.surfaceHint ?? 'unknown';
  }

  return {
    schemaVersion: UNIFIED_AUDIT_SCHEMA_VERSION,
    surface,
    surfacesByRule: surfacesByRule.length ? surfacesByRule : undefined,
    verdict: input.verdict,
    rulesTriggered,
    reason: input.reason,
    correlation: input.correlation,
  };
}
