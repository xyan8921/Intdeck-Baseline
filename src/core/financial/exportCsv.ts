import type { FinancialObservation } from './types';

const BOM = '\uFEFF';

export function financialObservationsToCsv(rows: FinancialObservation[]): string {
  const header = [
    'id',
    'schemaVersion',
    'source',
    'reconciliationStatus',
    'intentId',
    'solutionId',
    'amount',
    'currency',
    'fiscalPeriod',
    'fiscalYearContext',
    'userSide',
    'valueAttribution',
    'ownershipClaim',
    'claimReason',
    'claimStatus',
    'budgetScope',
    'label',
    'auditRef',
  ];
  const lines = rows.map((r) =>
    [
      r.id,
      r.schemaVersion,
      r.source,
      r.reconciliationStatus,
      r.intentId,
      r.solutionId ?? '',
      r.amount ?? '',
      r.currency,
      r.fiscalPeriod ?? '',
      r.fiscalYearContext ?? '',
      r.userSide ?? '',
      r.valueAttribution ?? '',
      r.ownershipClaim ?? '',
      escapeCsv(r.claimReason ?? ''),
      r.claimStatus ?? '',
      r.budgetScope ?? '',
      escapeCsv(r.label),
      r.auditRef,
    ].join(',')
  );
  return BOM + [header.join(','), ...lines].join('\r\n');
}

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
