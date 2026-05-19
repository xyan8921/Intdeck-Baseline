import type { FinancialDataSensitivity, FinancialExportActorType } from '../backend-contract/types';
import type { EthicsDecision } from '../ai/types';
import type { EthicsInput } from './types';
import {
  ETHICS_RULE_E3_FIN_EXPORT_CANDIDATE_INVALID,
  ETHICS_RULE_E6_FIN_EXPORT_L4_AUDIT_ONLY,
  ETHICS_RULE_E6_FIN_EXPORT_OPERATOR_SENSITIVITY_CAP,
  ETHICS_RULE_E6_FIN_EXPORT_PASS_SCREEN,
} from './ruleIds';

const FINANCIAL_EXPORT_SKILL = 'financial-export';

const ACTORS = new Set<FinancialExportActorType>(['audit', 'finance', 'finance-api', 'operator']);
const LEVELS = new Set<FinancialDataSensitivity>(['L1', 'L2', 'L3', 'L4']);

function isFinancialExportCandidate(
  c: unknown
): c is {
  kind: 'financial-export';
  actorType: FinancialExportActorType;
  dataSensitivity: FinancialDataSensitivity;
} {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  const o = c as Record<string, unknown>;
  return (
    o.kind === 'financial-export' &&
    typeof o.actorType === 'string' &&
    ACTORS.has(o.actorType as FinancialExportActorType) &&
    typeof o.dataSensitivity === 'string' &&
    LEVELS.has(o.dataSensitivity as FinancialDataSensitivity)
  );
}

/**
 * 财务导出动作上的伦理规则（E3/E6）。非本 skill 返回 null，由调用方走默认 allow。
 */
export function applyFinancialExportEthicsRules(input: EthicsInput): EthicsDecision | null {
  if (input.subject.skillId !== FINANCIAL_EXPORT_SKILL) {
    return null;
  }

  if (!isFinancialExportCandidate(input.candidate)) {
    return {
      verdict: 'block',
      reason:
        'EXPORT_ETHICS: invalid financial-export candidate (E3: no false execution / shape must be explicit).',
      rulesTriggered: [ETHICS_RULE_E3_FIN_EXPORT_CANDIDATE_INVALID],
    };
  }

  const { actorType, dataSensitivity } = input.candidate;

  if (dataSensitivity === 'L4' && actorType !== 'audit') {
    return {
      verdict: 'block',
      reason:
        'EXPORT_ETHICS: L4 financial data export is restricted to audit role (E6: privacy / least exposure).',
      rulesTriggered: [ETHICS_RULE_E6_FIN_EXPORT_L4_AUDIT_ONLY],
    };
  }

  if (actorType === 'operator' && (dataSensitivity === 'L3' || dataSensitivity === 'L4')) {
    return {
      verdict: 'block',
      reason:
        'EXPORT_ETHICS: operator cannot export L3/L4 financial data (E6: least exposure / segregation).',
      rulesTriggered: [ETHICS_RULE_E6_FIN_EXPORT_OPERATOR_SENSITIVITY_CAP],
    };
  }

  return {
    verdict: 'allow',
    effectiveOutput: input.candidate,
    rulesTriggered: [ETHICS_RULE_E6_FIN_EXPORT_PASS_SCREEN],
  };
}
