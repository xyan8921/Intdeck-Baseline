import type { EthicsDecision } from '../ai/types';
import type { EthicsInput } from './types';
import { scanCoreAiCandidateForCoerciveLanguage } from './e2CoerciveLanguage';
import { scanCoreAiCandidateForExclusionaryLanguage } from './e5ExclusionaryLanguage';
import {
  ETHICS_RULE_E2_CORE_OUTPUT_PASS,
  ETHICS_RULE_E3_CORE_CLARIFY_INVALID,
  ETHICS_RULE_E3_CORE_CLARIFY_PASS,
  ETHICS_RULE_E3_CORE_KEYWORDS_INVALID,
  ETHICS_RULE_E3_CORE_KEYWORDS_PASS,
  ETHICS_RULE_E3_CORE_PLAN_INVALID,
  ETHICS_RULE_E3_CORE_PLAN_PASS,
  ETHICS_RULE_E3_CORE_VARIATION_INVALID,
  ETHICS_RULE_E3_CORE_VARIATION_PASS,
  ETHICS_RULE_E5_CORE_OUTPUT_PASS,
} from './ruleIds';

function mergeCoreAiE5(base: EthicsDecision, candidate: unknown, label: string): EthicsDecision {
  if (base.verdict !== 'allow') {
    return base;
  }
  const e5 = scanCoreAiCandidateForExclusionaryLanguage(candidate, label);
  if (e5) {
    return e5;
  }
  return {
    ...base,
    rulesTriggered: [...(base.rulesTriggered ?? []), ETHICS_RULE_E5_CORE_OUTPUT_PASS],
  };
}

function mergeCoreAiE2(base: EthicsDecision, candidate: unknown, label: string): EthicsDecision {
  if (base.verdict !== 'allow') {
    return base;
  }
  const e2 = scanCoreAiCandidateForCoerciveLanguage(candidate, label);
  if (e2) {
    return e2;
  }
  const afterE2 = {
    ...base,
    rulesTriggered: [...(base.rulesTriggered ?? []), ETHICS_RULE_E2_CORE_OUTPUT_PASS],
  };
  return mergeCoreAiE5(afterE2, candidate, label);
}

const LABEL_CLARIFY = 'core_ai_clarify';
const LABEL_PLAN = 'core_ai_plan';
const LABEL_VARIATION = 'core_ai_variation';
const LABEL_KEYWORDS = 'core_ai_keywords_brief';

const Q_TYPES = new Set(['single_choice', 'multi_choice', 'text']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function blockE3Core(reason: string, ruleId: string): EthicsDecision {
  return {
    verdict: 'block',
    reason: `CORE_AI_ETHICS: ${reason} (E3: explicit shape / no false execution).`,
    rulesTriggered: [ruleId],
  };
}

function validateClarifyOutput(candidate: unknown): EthicsDecision {
  if (!isPlainObject(candidate)) {
    return blockE3Core('clarify output must be an object', ETHICS_RULE_E3_CORE_CLARIFY_INVALID);
  }
  if (!Array.isArray(candidate.questions)) {
    return blockE3Core('clarify.questions must be an array', ETHICS_RULE_E3_CORE_CLARIFY_INVALID);
  }
  if (!('draftMeta' in candidate)) {
    return blockE3Core('clarify.draftMeta is required', ETHICS_RULE_E3_CORE_CLARIFY_INVALID);
  }
  for (const q of candidate.questions) {
    if (!isPlainObject(q)) {
      return blockE3Core('clarify question must be an object', ETHICS_RULE_E3_CORE_CLARIFY_INVALID);
    }
    if (typeof q.id !== 'string' || typeof q.text !== 'string') {
      return blockE3Core('clarify question id/text must be strings', ETHICS_RULE_E3_CORE_CLARIFY_INVALID);
    }
    if (typeof q.type !== 'string' || !Q_TYPES.has(q.type)) {
      return blockE3Core('clarify question type invalid', ETHICS_RULE_E3_CORE_CLARIFY_INVALID);
    }
  }
  return mergeCoreAiE2(
    {
      verdict: 'allow',
      effectiveOutput: candidate,
      rulesTriggered: [ETHICS_RULE_E3_CORE_CLARIFY_PASS],
    },
    candidate,
    LABEL_CLARIFY
  );
}

function validatePlanOutput(candidate: unknown): EthicsDecision {
  if (!isPlainObject(candidate)) {
    return blockE3Core('plan output must be an object', ETHICS_RULE_E3_CORE_PLAN_INVALID);
  }
  if (!Array.isArray(candidate.tasks) || !Array.isArray(candidate.milestones)) {
    return blockE3Core('plan.tasks and plan.milestones must be arrays', ETHICS_RULE_E3_CORE_PLAN_INVALID);
  }
  return mergeCoreAiE2(
    {
      verdict: 'allow',
      effectiveOutput: candidate,
      rulesTriggered: [ETHICS_RULE_E3_CORE_PLAN_PASS],
    },
    candidate,
    LABEL_PLAN
  );
}

function validateVariationOutput(candidate: unknown): EthicsDecision {
  if (!isPlainObject(candidate)) {
    return blockE3Core('variation output must be an object', ETHICS_RULE_E3_CORE_VARIATION_INVALID);
  }
  if (!Array.isArray(candidate.variations)) {
    return blockE3Core('variation.variations must be an array', ETHICS_RULE_E3_CORE_VARIATION_INVALID);
  }
  return mergeCoreAiE2(
    {
      verdict: 'allow',
      effectiveOutput: candidate,
      rulesTriggered: [ETHICS_RULE_E3_CORE_VARIATION_PASS],
    },
    candidate,
    LABEL_VARIATION
  );
}

function validateKeywordsOutput(candidate: unknown): EthicsDecision {
  if (!isPlainObject(candidate)) {
    return blockE3Core('keywords output must be an object', ETHICS_RULE_E3_CORE_KEYWORDS_INVALID);
  }
  if (!Array.isArray(candidate.keywords)) {
    return blockE3Core('keywords.keywords must be an array', ETHICS_RULE_E3_CORE_KEYWORDS_INVALID);
  }
  if (!candidate.keywords.every((k) => typeof k === 'string')) {
    return blockE3Core('keywords.keywords must be strings', ETHICS_RULE_E3_CORE_KEYWORDS_INVALID);
  }
  if (typeof candidate.brief !== 'string' || candidate.brief.trim().length === 0) {
    return blockE3Core('keywords.brief must be a non-empty string', ETHICS_RULE_E3_CORE_KEYWORDS_INVALID);
  }
  return mergeCoreAiE2(
    {
      verdict: 'allow',
      effectiveOutput: candidate,
      rulesTriggered: [ETHICS_RULE_E3_CORE_KEYWORDS_PASS],
    },
    candidate,
    LABEL_KEYWORDS
  );
}

/**
 * Core AI 各阶段输出：E3 形状校验 + **E2 胁迫话术** + **E5 排斥性表述**扫描。仅处理 `CoreAiService` 的 label；其它返回 null。
 */
export function applyCoreAiOutputEthicsRules(input: EthicsInput): EthicsDecision | null {
  const label = input.subject.label;
  switch (label) {
    case LABEL_CLARIFY:
      return validateClarifyOutput(input.candidate);
    case LABEL_PLAN:
      return validatePlanOutput(input.candidate);
    case LABEL_VARIATION:
      return validateVariationOutput(input.candidate);
    case LABEL_KEYWORDS:
      return validateKeywordsOutput(input.candidate);
    default:
      return null;
  }
}
