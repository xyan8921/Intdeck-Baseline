import type { EthicsDecision } from '../ai/types';
import type { EthicsInput } from './types';
import {
  ETHICS_RULE_E2_OUTBOUND_CONFIRM_REQUIRED,
  ETHICS_RULE_E2_OUTBOUND_PASS,
  ETHICS_RULE_E3_OUTBOUND_CANDIDATE_INVALID,
} from './ruleIds';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * `runOutbound` 专用：E2 用户主权 — 若声明需确认则必须 `userConfirmed === true`。
 */
export function applyOutboundEthicsRules(input: EthicsInput): EthicsDecision | null {
  const sid = input.subject.skillId;
  if (!sid?.startsWith('outbound:')) {
    return null;
  }
  const c = input.candidate;
  if (!isPlainObject(c) || c.kind !== 'outbound') {
    return {
      verdict: 'block',
      reason: 'OUTBOUND_ETHICS: invalid outbound candidate shape (E3).',
      rulesTriggered: [ETHICS_RULE_E3_OUTBOUND_CANDIDATE_INVALID],
    };
  }
  const requires = c.requiresUserConfirmation === true;
  const confirmed = c.userConfirmed === true;
  if (requires && !confirmed) {
    return {
      verdict: 'block',
      reason:
        'OUTBOUND_ETHICS: user confirmation required before this outbound action (E2: user sovereignty).',
      rulesTriggered: [ETHICS_RULE_E2_OUTBOUND_CONFIRM_REQUIRED],
    };
  }
  return {
    verdict: 'allow',
    effectiveOutput: input.candidate,
    rulesTriggered: [ETHICS_RULE_E2_OUTBOUND_PASS],
  };
}
