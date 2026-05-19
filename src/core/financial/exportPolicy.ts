import type {
  FinancialDataSensitivity,
  FinancialExportActorType,
  FinancialExportDenialCode,
} from '../backend-contract/types';

const ALLOW_MATRIX: Record<FinancialExportActorType, FinancialDataSensitivity[]> = {
  audit: ['L1', 'L2', 'L3', 'L4'],
  finance: ['L1', 'L2', 'L3'],
  'finance-api': ['L1', 'L2', 'L3'],
  operator: ['L1', 'L2'],
};

export type FinancialExportPermissionResult =
  | { allowed: true }
  | {
      allowed: false;
      code: FinancialExportDenialCode;
      reason: string;
    };

export function validateFinancialExportPermission(input: {
  actorType: FinancialExportActorType;
  dataSensitivity: FinancialDataSensitivity;
}): FinancialExportPermissionResult {
  const allowedLevels = ALLOW_MATRIX[input.actorType] ?? [];
  if (!allowedLevels.includes(input.dataSensitivity)) {
    return {
      allowed: false,
      code: 'EXPORT_DENIED_ROLE_SENSITIVITY',
      reason: `EXPORT_DENIED: ${input.actorType} cannot export ${input.dataSensitivity}`,
    };
  }
  return { allowed: true };
}

