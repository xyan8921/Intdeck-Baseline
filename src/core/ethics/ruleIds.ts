/**
 * 伦理规则 ID（稳定、可审计、与 docs/INTDONE_ETHICS_RULE_ALIGNMENT_v1.md 对齐）
 */
export const ETHICS_RULE_E3_FIN_EXPORT_CANDIDATE_INVALID =
  'ethics.e3.financial-export.candidate-invalid' as const;
export const ETHICS_RULE_E6_FIN_EXPORT_L4_AUDIT_ONLY =
  'ethics.e6.financial-export.l4-audit-only' as const;
/** operator 不得导出 L3/L4（E6 最小暴露；伦理层先于业务矩阵） */
export const ETHICS_RULE_E6_FIN_EXPORT_OPERATOR_SENSITIVITY_CAP =
  'ethics.e6.financial-export.operator-sensitivity-cap' as const;
/** 财务导出通过伦理屏（双保险与候选校验均通过） */
export const ETHICS_RULE_E6_FIN_EXPORT_PASS_SCREEN = 'ethics.e6.financial-export.pass-screen' as const;

/** Core AI — clarify 输出结构非法（E3） */
export const ETHICS_RULE_E3_CORE_CLARIFY_INVALID = 'ethics.e3.core-ai.clarify-output-invalid' as const;
export const ETHICS_RULE_E3_CORE_CLARIFY_PASS = 'ethics.e3.core-ai.clarify-output.pass-screen' as const;
/** Core AI — plan 输出结构非法（E3） */
export const ETHICS_RULE_E3_CORE_PLAN_INVALID = 'ethics.e3.core-ai.plan-output-invalid' as const;
export const ETHICS_RULE_E3_CORE_PLAN_PASS = 'ethics.e3.core-ai.plan-output.pass-screen' as const;
/** Core AI — variation 输出结构非法（E3） */
export const ETHICS_RULE_E3_CORE_VARIATION_INVALID =
  'ethics.e3.core-ai.variation-output-invalid' as const;
export const ETHICS_RULE_E3_CORE_VARIATION_PASS =
  'ethics.e3.core-ai.variation-output.pass-screen' as const;
/** Core AI — keywords 输出结构非法（E3） */
export const ETHICS_RULE_E3_CORE_KEYWORDS_INVALID =
  'ethics.e3.core-ai.keywords-output-invalid' as const;
export const ETHICS_RULE_E3_CORE_KEYWORDS_PASS =
  'ethics.e3.core-ai.keywords-output.pass-screen' as const;

/** E2 不与人类对抗 — Core AI 输出含胁迫/勒索式话术 */
export const ETHICS_RULE_E2_CORE_COERCIVE_LANGUAGE = 'ethics.e2.core-ai.coercive-language' as const;
/** E2 — Core AI 输出通过胁迫话术屏 */
export const ETHICS_RULE_E2_CORE_OUTPUT_PASS = 'ethics.e2.core-ai.output.pass-screen' as const;
/** E3 — outbound 候选结构非法 */
export const ETHICS_RULE_E3_OUTBOUND_CANDIDATE_INVALID =
  'ethics.e3.outbound.candidate-invalid' as const;
/** E2 — 出站要求用户确认但未声明已确认 */
export const ETHICS_RULE_E2_OUTBOUND_CONFIRM_REQUIRED =
  'ethics.e2.outbound.user-confirmation-required' as const;
/** E2 — 出站伦理屏通过（或无需确认） */
export const ETHICS_RULE_E2_OUTBOUND_PASS = 'ethics.e2.outbound.pass-screen' as const;

/** E4 — 交付物缺少撤销令牌 */
export const ETHICS_RULE_E4_DELIVERABLE_MISSING_UNDO_TOKEN =
  'ethics.e4.deliverable.missing-undo-token' as const;
/** E4 — 交付物 undoToken 格式非法 */
export const ETHICS_RULE_E4_DELIVERABLE_UNDO_TOKEN_MALFORMED =
  'ethics.e4.deliverable.undo-token-malformed' as const;
/** E4 — 交付物撤销元数据通过屏 */
export const ETHICS_RULE_E4_DELIVERABLE_PASS_SCREEN = 'ethics.e4.deliverable.pass-screen' as const;
/** E4 — 撤销候选结构非法 */
export const ETHICS_RULE_E4_UNDO_CANDIDATE_INVALID = 'ethics.e4.undo.candidate-invalid' as const;
/** E4 — 撤销 token 格式非法 */
export const ETHICS_RULE_E4_UNDO_TOKEN_MALFORMED = 'ethics.e4.undo.token-malformed' as const;
/** E4 — 撤销请求通过屏 */
export const ETHICS_RULE_E4_UNDO_PASS_SCREEN = 'ethics.e4.undo.pass-screen' as const;

/** E5 — Core AI 输出含排斥性/歧视性高风险表述 */
export const ETHICS_RULE_E5_CORE_EXCLUSIONARY_LANGUAGE =
  'ethics.e5.core-ai.exclusionary-language' as const;
/** E5 — Core AI 输出通过包容性屏 */
export const ETHICS_RULE_E5_CORE_OUTPUT_PASS = 'ethics.e5.core-ai.output.pass-screen' as const;

/** E5 — 预置 Scenario 静态文案含排斥性表述（`preset-templates.json` 等） */
export const ETHICS_RULE_E5_PRESET_TEMPLATE_EXCLUSIONARY_LANGUAGE =
  'ethics.e5.preset-template.exclusionary-language' as const;
/** E5 — 预置模板通过排斥性扫描 */
export const ETHICS_RULE_E5_PRESET_TEMPLATE_PASS_SCREEN =
  'ethics.e5.preset-template.pass-screen' as const;
/** E5 — 预置模板 metadata 未声明 E5（建议性，不阻断） */
export const ETHICS_RULE_E5_PRESET_TEMPLATE_E5_NOT_DECLARED =
  'ethics.e5.preset-template.metadata.e5-not-declared' as const;

/** E5 — 关键词束参数文本含排斥性表述 */
export const ETHICS_RULE_E5_KEYWORD_BUNDLE_EXCLUSIONARY_LANGUAGE =
  'ethics.e5.keyword-bundle.exclusionary-language' as const;
/** E5 — 关键词束参数通过排斥性扫描 */
export const ETHICS_RULE_E5_KEYWORD_BUNDLE_PASS_SCREEN =
  'ethics.e5.keyword-bundle.pass-screen' as const;

/** E5 — 意图路由输入（自然语言描述 / 入口理解）含排斥性表述 */
export const ETHICS_RULE_E5_INTENT_ROUTE_EXCLUSIONARY_LANGUAGE =
  'ethics.e5.intent-route.exclusionary-language' as const;
/** E5 — 意图路由输入通过排斥性扫描 */
export const ETHICS_RULE_E5_INTENT_ROUTE_PASS_SCREEN =
  'ethics.e5.intent-route.pass-screen' as const;
