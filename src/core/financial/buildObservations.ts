import type { Intent, Solution } from '../storage/types';
import type { FinancialObservation } from './types';

/**
 * 仅从本地 Intdone 数据构建观测行（MVP，无外部 ERP）
 */
export function buildFinancialObservations(
  intents: Intent[],
  solutions: Solution[]
): FinancialObservation[] {
  const solByIntent = new Map<string, Solution>();
  for (const s of solutions) {
    solByIntent.set(s.intentId, s);
  }

  return intents.map((intent) => {
    const m = intent.meta as Record<string, unknown> | undefined;
    const sol = solByIntent.get(intent.id);
    let amount: number | undefined;
    const raw = m?.budget;
    const per =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(String(raw).replace(/[^\d.]/g, ''))
          : NaN;
    const hc = m?.budgetHeadcount;
    const headcount = typeof hc === 'number' && hc > 0 ? hc : undefined;
    if (m?.budgetScope === 'per_person' && headcount && Number.isFinite(per)) {
      amount = per * headcount;
    } else if (Number.isFinite(per)) {
      amount = per;
    }

    const fiscalPeriod = toFiscalPeriod(intent.createdAt);
    const fiscalYearContext = String(intent.createdAt.getUTCFullYear());
    const userSide = (m?.userSide === 'B端' || m?.userSide === 'C端' ? m.userSide : intent.category) as
      | 'B端'
      | 'C端';
    const valueAttribution =
      m?.valueAttribution === 'organization' || m?.valueAttribution === 'ambiguous'
        ? m.valueAttribution
        : 'personal';
    return {
      id: `obs_${intent.id}`,
      schemaVersion: 'v1.0',
      source: 'intdone_suggested' as const,
      reconciliationStatus: 'PENDING' as const,
      intentId: intent.id,
      solutionId: sol?.id,
      amount,
      currency: (m?.budgetCurrency as string) || 'CNY',
      fiscalPeriod,
      fiscalYearContext,
      userSide,
      valueAttribution,
      label: intent.content.slice(0, 120),
      auditRef: intent.id,
      budgetScope: m?.budgetScope as string | undefined,
    };
  });
}

function toFiscalPeriod(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
