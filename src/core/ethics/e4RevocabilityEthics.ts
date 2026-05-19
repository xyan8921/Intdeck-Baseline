import type { EthicsDecision } from '../ai/types';
import type { EthicsInput } from './types';
import {
  ETHICS_RULE_E4_DELIVERABLE_MISSING_UNDO_TOKEN,
  ETHICS_RULE_E4_DELIVERABLE_PASS_SCREEN,
  ETHICS_RULE_E4_DELIVERABLE_UNDO_TOKEN_MALFORMED,
  ETHICS_RULE_E4_UNDO_CANDIDATE_INVALID,
  ETHICS_RULE_E4_UNDO_PASS_SCREEN,
  ETHICS_RULE_E4_UNDO_TOKEN_MALFORMED,
} from './ruleIds';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** E4：与 `Deliverable.metadata.undoToken` / `IntentExecutionEngine.undo` 共用同一良形判定 */
export function isE4UndoTokenWellFormed(token: string): boolean {
  return typeof token === 'string' && /^undo-.+/.test(token);
}

function extractUndoTokenFromDeliverableCandidate(candidate: unknown): unknown {
  if (!isPlainObject(candidate)) {
    return undefined;
  }
  if (isPlainObject(candidate.metadata) && 'undoToken' in candidate.metadata) {
    return candidate.metadata.undoToken;
  }
  if ('undoToken' in candidate) {
    return candidate.undoToken;
  }
  return undefined;
}

/**
 * E4 可撤销链：交付物元数据须带良形 `undoToken`；撤销请求候选须为 `{ token }` 且 token 良形。
 * 仅处理 `skillId` 为 `deliverable:metadata` 或 `execution:undo` 的 action；其它返回 null。
 */
export function applyE4RevocabilityEthicsRules(input: EthicsInput): EthicsDecision | null {
  const sid = input.subject.skillId;
  if (sid === 'deliverable:metadata') {
    const undoToken = extractUndoTokenFromDeliverableCandidate(input.candidate);
    if (undoToken === undefined || undoToken === '') {
      return {
        verdict: 'block',
        reason: 'E4_REVOCABILITY: deliverable metadata missing undoToken.',
        rulesTriggered: [ETHICS_RULE_E4_DELIVERABLE_MISSING_UNDO_TOKEN],
      };
    }
    if (typeof undoToken !== 'string' || !isE4UndoTokenWellFormed(undoToken)) {
      return {
        verdict: 'block',
        reason: 'E4_REVOCABILITY: undoToken must be a non-empty string with prefix undo-.',
        rulesTriggered: [ETHICS_RULE_E4_DELIVERABLE_UNDO_TOKEN_MALFORMED],
      };
    }
    return {
      verdict: 'allow',
      effectiveOutput: input.candidate,
      rulesTriggered: [ETHICS_RULE_E4_DELIVERABLE_PASS_SCREEN],
    };
  }

  if (sid === 'execution:undo') {
    const c = input.candidate;
    if (!isPlainObject(c) || typeof c.token !== 'string') {
      return {
        verdict: 'block',
        reason: 'E4_REVOCABILITY: undo candidate must be an object with string token.',
        rulesTriggered: [ETHICS_RULE_E4_UNDO_CANDIDATE_INVALID],
      };
    }
    if (!isE4UndoTokenWellFormed(c.token)) {
      return {
        verdict: 'block',
        reason: 'E4_REVOCABILITY: undo token malformed.',
        rulesTriggered: [ETHICS_RULE_E4_UNDO_TOKEN_MALFORMED],
      };
    }
    return {
      verdict: 'allow',
      effectiveOutput: c,
      rulesTriggered: [ETHICS_RULE_E4_UNDO_PASS_SCREEN],
    };
  }

  return null;
}
