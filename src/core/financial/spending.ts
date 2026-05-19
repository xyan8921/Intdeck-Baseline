import type { Intent, Solution } from '../storage/types';
import type { FinancialObservation } from './types';
import { buildFinancialObservations } from './buildObservations';

export function buildPersonalSpendingObservations(
  intents: Intent[],
  solutions: Solution[]
): FinancialObservation[] {
  const base = buildFinancialObservations(intents, solutions);
  const intentMap = new Map(intents.map((i) => [i.id, i]));
  return base.filter((row) => {
    const intent = intentMap.get(row.intentId);
    if (!intent) return false;
    if (intent.category !== 'C端') return false;
    const attribution = (intent.meta?.valueAttribution ?? 'personal') as string;
    return attribution !== 'organization';
  });
}

