import { describe, expect, it } from 'vitest';
import { summarizePersonalSpending } from './spendingSummary';
import type { FinancialObservation } from './types';

describe('summarizePersonalSpending', () => {
  it('computes planned total and placeholder actual total', () => {
    const rows: FinancialObservation[] = [
      {
        id: 'o1',
        schemaVersion: 'v1.0',
        source: 'intdone_suggested',
        reconciliationStatus: 'PENDING',
        intentId: 'i1',
        amount: 2000,
        currency: 'CNY',
        label: 'a',
        auditRef: 'i1',
      },
      {
        id: 'o2',
        schemaVersion: 'v1.0',
        source: 'intdone_suggested',
        reconciliationStatus: 'PENDING',
        intentId: 'i2',
        amount: 2000,
        currency: 'CNY',
        label: 'b',
        auditRef: 'i2',
      },
    ];
    const summary = summarizePersonalSpending(rows);
    expect(summary.plannedInputTotal).toBe(4000);
    expect(summary.actualSpentTotal).toBe(0);
    expect(summary.hasActualSpentData).toBe(false);
  });
});

