import type { FinancialObservation } from './types';

export interface SpendingSummary {
  plannedInputTotal: number;
  actualSpentTotal: number;
  hasActualSpentData: boolean;
}

export function summarizePersonalSpending(rows: FinancialObservation[]): SpendingSummary {
  const plannedInputTotal = rows.reduce(
    (sum, row) => sum + (typeof row.amount === 'number' ? row.amount : 0),
    0
  );
  // Stage B 当前尚未接入真实支付事件源，先保持占位口径
  const actualSpentTotal = 0;
  const hasActualSpentData = false;
  return { plannedInputTotal, actualSpentTotal, hasActualSpentData };
}

