import type { FinancialDataSensitivity, FinancialExportActorType } from '../backend-contract/types';

/** 命中规则标识（审计/回放）；随策略域扩展 */
export const FINANCIAL_EXPORT_MATRIX_RULE_ID = 'financial-export.role-sensitivity-matrix' as const;
export const FINANCIAL_EXPORT_POLICY_RULE_ID = 'financial-export.policy-snapshot' as const;
export const FINANCIAL_EXPORT_ETHICS_RULE_ID = 'financial-export.ethics-guard' as const;

export type PolicyEvaluationKind = 'financial-export';

export type PolicyEvaluationRequest = {
  kind: 'financial-export';
  actorType: FinancialExportActorType;
  dataSensitivity: FinancialDataSensitivity;
};

export type PolicyEvaluationResult =
  | {
      verdict: 'allow';
      kind: 'financial-export';
      ruleId: typeof FINANCIAL_EXPORT_MATRIX_RULE_ID;
      actorType: FinancialExportActorType;
      dataSensitivity: FinancialDataSensitivity;
      /** 参与判定的策略版本（本地 PolicySnapshot），无快照时不填 */
      policyVersion?: string;
    }
  | {
      verdict: 'deny';
      kind: 'financial-export';
      ruleId: typeof FINANCIAL_EXPORT_POLICY_RULE_ID;
      code: 'EXPORT_DENIED_POLICY_DISABLED' | 'EXPORT_DENIED_POLICY_UNAVAILABLE';
      reason: string;
      actorType: FinancialExportActorType;
      dataSensitivity: FinancialDataSensitivity;
      policyVersion?: string;
    }
  | {
      verdict: 'deny';
      kind: 'financial-export';
      ruleId: typeof FINANCIAL_EXPORT_ETHICS_RULE_ID;
      code: 'EXPORT_DENIED_ETHICS';
      reason: string;
      actorType: FinancialExportActorType;
      dataSensitivity: FinancialDataSensitivity;
      policyVersion?: string;
    }
  | {
      verdict: 'deny';
      kind: 'financial-export';
      ruleId: typeof FINANCIAL_EXPORT_MATRIX_RULE_ID;
      code: 'EXPORT_DENIED_ROLE_SENSITIVITY' | 'EXPORT_DENIED';
      reason: string;
      actorType: FinancialExportActorType;
      dataSensitivity: FinancialDataSensitivity;
      policyVersion?: string;
    };
