import { describe, expect, it } from 'vitest';
import { buildFinancialExportPackage, verifyCsvSha256MatchesManifest } from './exportAudit';
import type { FinancialObservation } from './types';

describe('buildFinancialExportPackage', () => {
  it('should build csv and manifest with sha256', async () => {
    const rows: FinancialObservation[] = [
      {
        id: 'obs_1',
        schemaVersion: 'v1.0',
        source: 'intdone_suggested',
        reconciliationStatus: 'PENDING',
        intentId: 'intent_1',
        amount: 1000,
        currency: 'CNY',
        fiscalPeriod: '2026-03',
        fiscalYearContext: '2026',
        label: '测试预算',
        auditRef: 'intent_1',
      },
    ];
    const pkg = await buildFinancialExportPackage(rows, {
      actorType: 'operator',
      actorId: 'dev-local',
      purpose: 'analytics',
      scope: 'local-dev',
      dataDomain: 'enterprise-finance',
      dataSensitivity: 'L2',
    });
    expect(pkg.csv).toContain('reconciliationStatus');
    expect(pkg.manifest.csvSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(pkg.manifest.exportSessionId).toMatch(/^fes_/);
    expect(pkg.manifest.auditTrailSchemaVersion).toBe(1);
    expect(pkg.manifest.rowCount).toBe(1);
    expect(pkg.manifest.schemaVersion).toBe('v1.0');
    expect(await verifyCsvSha256MatchesManifest(pkg.csv, pkg.manifest)).toBe(true);
    expect(await verifyCsvSha256MatchesManifest(`${pkg.csv}x`, pkg.manifest)).toBe(false);
  });

  it('should reject invalid context', async () => {
    const rows: FinancialObservation[] = [];
    await expect(
      buildFinancialExportPackage(rows, {
        actorType: 'operator',
        actorId: '',
        purpose: 'analytics',
        scope: 'local-dev',
        dataDomain: 'enterprise-finance',
        dataSensitivity: 'L2',
      })
    ).rejects.toThrow('EXPORT_CONTEXT_INVALID');
  });

  it('should reject invalid sensitivity', async () => {
    await expect(
      buildFinancialExportPackage([], {
        actorType: 'operator',
        actorId: 'u1',
        purpose: 'analytics',
        scope: 'local-dev',
        dataDomain: 'enterprise-finance',
        dataSensitivity: 'L9' as unknown as 'L1',
      })
    ).rejects.toThrow('EXPORT_CONTEXT_INVALID');
  });
});

