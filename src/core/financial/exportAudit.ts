import type { FinancialObservation } from './types';
import { financialObservationsToCsv } from './exportCsv';
import type {
  FinancialDataDomain,
  FinancialDataSensitivity,
  FinancialExportActorType,
  FinancialExportAuditRequest,
} from '../backend-contract/types';
const ALLOWED_DOMAINS: FinancialDataDomain[] = ['enterprise-finance', 'personal-spending'];
const ALLOWED_SENSITIVITY: FinancialDataSensitivity[] = ['L1', 'L2', 'L3', 'L4'];

export interface FinancialExportContext {
  actorType: FinancialExportActorType;
  actorId: string;
  purpose: string;
  scope: string;
  dataDomain: FinancialDataDomain;
  dataSensitivity: FinancialDataSensitivity;
}

export interface FinancialExportManifest {
  exportBatchId: string;
  /** 客户端生成的导出会话 ID，与 `FinancialExportAuditRequest.exportSessionId` 一致 */
  exportSessionId: string;
  /**
   * 审计链 manifest 包格式版本（与观测行 `schemaVersion`、Ingress payload `schemaVersion` 区分）。
   * 升级字段时递增，便于回放与后端兼容。
   */
  auditTrailSchemaVersion: number;
  exportedAt: string;
  schemaVersion: string;
  actorType: FinancialExportActorType;
  actorId: string;
  purpose: string;
  scope: string;
  dataDomain: FinancialDataDomain;
  dataSensitivity: FinancialDataSensitivity;
  rowCount: number;
  csvSha256: string;
}

/** 计算 UTF-8 文本的 SHA-256 十六进制摘要（与导出 manifest 一致） */
export async function sha256HexOfUtf8Text(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 校验 CSV 文本与 manifest 中 `csvSha256` 是否一致（本地对账 / 回放） */
export async function verifyCsvSha256MatchesManifest(
  csv: string,
  manifest: Pick<FinancialExportManifest, 'csvSha256'>
): Promise<boolean> {
  const h = await sha256HexOfUtf8Text(csv);
  return h === manifest.csvSha256;
}

export async function buildFinancialExportPackage(
  rows: FinancialObservation[],
  context: FinancialExportContext
): Promise<{ csv: string; manifest: FinancialExportManifest }> {
  validateExportContext(context);
  const csv = financialObservationsToCsv(rows);
  const csvSha256 = await sha256HexOfUtf8Text(csv);
  const exportedAt = new Date().toISOString();
  const exportBatchId = `fexp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const exportSessionId = `fes_${Date.now()}_${randomToBase36(10)}`;
  const schemaVersion = rows[0]?.schemaVersion ?? 'v1.0';
  return {
    csv,
    manifest: {
      exportBatchId,
      exportSessionId,
      auditTrailSchemaVersion: 1,
      exportedAt,
      schemaVersion,
      actorType: context.actorType,
      actorId: context.actorId,
      purpose: context.purpose,
      scope: context.scope,
      dataDomain: context.dataDomain,
      dataSensitivity: context.dataSensitivity,
      rowCount: rows.length,
      csvSha256,
    },
  };
}

export function manifestToFinancialExportAuditRequest(
  manifest: FinancialExportManifest
): FinancialExportAuditRequest {
  return {
    exportBatchId: manifest.exportBatchId,
    exportSessionId: manifest.exportSessionId,
    csvSha256: manifest.csvSha256,
    actorType: manifest.actorType,
    actorId: manifest.actorId,
    purpose: manifest.purpose,
    scope: manifest.scope,
    dataDomain: manifest.dataDomain,
    dataSensitivity: manifest.dataSensitivity,
    rowCount: manifest.rowCount,
    occurredAt: manifest.exportedAt,
  };
}

function validateExportContext(context: FinancialExportContext): void {
  if (!context.actorId.trim()) {
    throw new Error('EXPORT_CONTEXT_INVALID: actorId is required');
  }
  if (!context.purpose.trim()) {
    throw new Error('EXPORT_CONTEXT_INVALID: purpose is required');
  }
  if (!context.scope.trim()) {
    throw new Error('EXPORT_CONTEXT_INVALID: scope is required');
  }
  if (!ALLOWED_DOMAINS.includes(context.dataDomain)) {
    throw new Error('EXPORT_CONTEXT_INVALID: dataDomain is invalid');
  }
  if (!ALLOWED_SENSITIVITY.includes(context.dataSensitivity)) {
    throw new Error('EXPORT_CONTEXT_INVALID: dataSensitivity is invalid');
  }
}

function randomToBase36(len: number): string {
  let s = '';
  while (s.length < len) {
    s += Math.random().toString(36).slice(2);
  }
  return s.slice(0, len);
}

