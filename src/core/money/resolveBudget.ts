/**
 * 预算金额解析（R-02）：币种/总预算 vs 人均 + 可选人数 → 用于 PlanShaper 的有效总额
 */

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type BudgetScope = 'total' | 'per_person';

export type BudgetCurrency = 'CNY' | 'USD' | 'EUR';

export interface ResolvedBudget {
  /** 用于按比例拆分的金额（总预算） */
  effectiveAmount: number;
  scope: BudgetScope;
  currency: BudgetCurrency;
  /** 展示用脚注 */
  footnote?: string;
}

/**
 * 从表单参数解析有效预算；缺省为 CNY + total。
 */
export function resolveBudgetFromParams(params: Record<string, unknown>): ResolvedBudget | null {
  const raw = toNumber(params.budget);
  if (raw === null || raw <= 0) return null;

  const currency = (params.budgetCurrency as BudgetCurrency) || 'CNY';
  const scope = (params.budgetScope as BudgetScope) || 'total';
  const headcount = toNumber(params.budgetHeadcount);

  if (scope === 'per_person' && headcount !== null && headcount > 0) {
    return {
      effectiveAmount: raw * headcount,
      scope,
      currency,
      footnote: `预算口径：${currency}，按 ${headcount} 人 × 人均 ${raw} 计总预算 ${raw * headcount}。`,
    };
  }

  if (scope === 'per_person') {
    return {
      effectiveAmount: raw,
      scope,
      currency,
      footnote: `预算口径：${currency} 人均金额；未填人数时拆分按该行金额提示，总预算请自行核算或补全人数。`,
    };
  }

  return {
    effectiveAmount: raw,
    scope: 'total',
    currency,
    footnote: `预算口径：${currency} 总预算。`,
  };
}
