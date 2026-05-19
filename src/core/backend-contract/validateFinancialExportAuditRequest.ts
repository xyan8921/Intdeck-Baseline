import type {
  FinancialDataDomain,
  FinancialDataSensitivity,
  FinancialExportActorType,
  FinancialExportAuditRequest,
} from './types';

const ACTORS: readonly FinancialExportActorType[] = ['audit', 'finance', 'finance-api', 'operator'];
const DOMAINS: readonly FinancialDataDomain[] = ['enterprise-finance', 'personal-spending'];
const SENS: readonly FinancialDataSensitivity[] = ['L1', 'L2', 'L3', 'L4'];

/** 与 manifest `sha256HexOfUtf8Text` 输出一致：64 位十六进制 */
const SHA256_HEX_RE = /^[0-9a-f]{64}$/i;

export type FinancialExportAuditRequestValidationFailure = {
  valid: false;
  code: string;
  message: string;
};

export type FinancialExportAuditRequestValidationResult =
  | { valid: true }
  | FinancialExportAuditRequestValidationFailure;

/**
 * 财务导出审计请求体校验（Stub 与 HTTP 客户端共用，对齐真实服务端“拒绝非法体”语义）。
 */
export function validateFinancialExportAuditRequest(
  req: FinancialExportAuditRequest
): FinancialExportAuditRequestValidationResult {
  if (typeof req.exportBatchId !== 'string' || !req.exportBatchId.trim()) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_EXPORT_BATCH_ID',
      message: 'exportBatchId is required',
    };
  }
  if (req.exportSessionId !== undefined) {
    if (typeof req.exportSessionId !== 'string' || !req.exportSessionId.trim()) {
      return {
        valid: false,
        code: 'EXPORT_AUDIT_INVALID_EXPORT_SESSION_ID',
        message: 'exportSessionId, when present, must be a non-empty string',
      };
    }
  }
  if (typeof req.csvSha256 !== 'string' || !SHA256_HEX_RE.test(req.csvSha256)) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_CSV_SHA256',
      message: 'csvSha256 must be a 64-char hex SHA-256 digest',
    };
  }
  if (typeof req.actorType !== 'string' || !ACTORS.includes(req.actorType as FinancialExportActorType)) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_ACTOR_TYPE',
      message: 'actorType is missing or not a supported financial export actor',
    };
  }
  if (typeof req.actorId !== 'string' || !req.actorId.trim()) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_ACTOR_ID',
      message: 'actorId is required',
    };
  }
  if (typeof req.purpose !== 'string' || !req.purpose.trim()) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_PURPOSE',
      message: 'purpose is required',
    };
  }
  if (typeof req.scope !== 'string' || !req.scope.trim()) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_SCOPE',
      message: 'scope is required',
    };
  }
  if (typeof req.dataDomain !== 'string' || !DOMAINS.includes(req.dataDomain as FinancialDataDomain)) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_DATA_DOMAIN',
      message: 'dataDomain is missing or not a supported value',
    };
  }
  if (
    typeof req.dataSensitivity !== 'string' ||
    !SENS.includes(req.dataSensitivity as FinancialDataSensitivity)
  ) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_DATA_SENSITIVITY',
      message: 'dataSensitivity is missing or not a supported level',
    };
  }
  if (!Number.isInteger(req.rowCount) || req.rowCount < 0) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_ROW_COUNT',
      message: 'rowCount must be a non-negative integer',
    };
  }
  if (typeof req.occurredAt !== 'string' || !req.occurredAt.trim()) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_OCCURRED_AT',
      message: 'occurredAt is required',
    };
  }
  if (Number.isNaN(Date.parse(req.occurredAt))) {
    return {
      valid: false,
      code: 'EXPORT_AUDIT_INVALID_OCCURRED_AT',
      message: 'occurredAt must be parseable as a date/time',
    };
  }
  return { valid: true };
}
