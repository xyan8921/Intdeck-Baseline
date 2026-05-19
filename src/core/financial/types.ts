/**
 * 财务观测行（见 INTDONE_FINANCIAL_ARCHITECTURE_v1.md）
 */

export type FinancialObservationSource = 'intdone_suggested' | 'connector' | 'erp_posted';
export type FinancialReconciliationStatus = 'MATCHED' | 'PENDING' | 'CONFLICT' | 'ORPHAN';

export interface FinancialObservation {
  id: string;
  schemaVersion: string;
  source: FinancialObservationSource;
  reconciliationStatus: FinancialReconciliationStatus;
  intentId: string;
  solutionId?: string;
  amount?: number;
  currency: string;
  fiscalPeriod?: string;
  fiscalYearContext?: string;
  userSide?: 'B端' | 'C端';
  valueAttribution?: 'personal' | 'organization' | 'ambiguous';
  ownershipClaim?: 'personal' | 'request-org';
  claimReason?: string;
  claimStatus?: 'draft' | 'submitted' | 'accepted' | 'rejected';
  /** 展示用短标签 */
  label: string;
  auditRef: string;
  budgetScope?: string;
}
