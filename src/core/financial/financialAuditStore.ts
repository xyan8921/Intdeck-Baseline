import type { IngressEvent } from '../backend-contract/types';
import { buildUnifiedAuditEventV1, type UnifiedAuditEventV1 } from '../observability/unifiedAuditSchema';

const STORAGE_KEY = 'intdone_financial_audit_events_v1';
const MAX_ENTRIES = 300;
let memoryStore: string | null = null;

/** 本地持久化的财务导出审计事件（与 Ingress `kind: audit` 中 subkind 对齐，供 Dev 回放） */
export interface FinancialAuditStoreEntry {
  id: string;
  /** 写入本机存储的时间 */
  recordedAt: string;
  /** Ingress 是否被 Stub/后端接受 */
  ingestOk: boolean;
  eventId: string;
  occurredAt: string;
  subkind: 'financial-export-audit' | 'financial-export-denied';
  exportBatchId?: string;
  exportSessionId?: string;
  outcome?: string;
  code?: string;
  message?: string;
  dataDomain?: string;
  dataSensitivity?: string;
  rowCount?: number;
  csvSha256?: string;
  /** `auditFinancialExport` / 拒绝路径上显式写入的 `traceId`（与契约 `BackendContractLogEntry.traceId` 对齐） */
  auditTraceId?: string;
  /** 同次审计事件经 `ingestEvents` 落 Ingress 时返回的 `traceId`（与契约 `ingestEvents` 行对齐） */
  ingressTraceId?: string;
  /** payload 内 schemaVersion（审计事件包版本） */
  payloadSchemaVersion?: number;
  /** 与统一 audit schema 对齐（Ingress 载荷未必含 ruleId，故以 subkind/code 为主） */
  auditEventV1?: UnifiedAuditEventV1;
}

function readRaw(): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(STORAGE_KEY);
  }
  return memoryStore;
}

function writeRaw(value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, value);
    return;
  }
  memoryStore = value;
}

function parseSubkind(p: Record<string, unknown>): FinancialAuditStoreEntry['subkind'] | null {
  const s = p.subkind;
  if (s === 'financial-export-audit' || s === 'financial-export-denied') {
    return s;
  }
  return null;
}

export function appendFinancialAuditEventsFromIngress(
  events: IngressEvent[],
  options: { ingestOk: boolean; ingressTraceId?: string }
): void {
  try {
    const raw = readRaw();
    const list: FinancialAuditStoreEntry[] = raw ? JSON.parse(raw) : [];
    for (const ev of events) {
      if (ev.kind !== 'audit') continue;
      const p = ev.payload;
      if (!p || typeof p !== 'object') continue;
      const subkind = parseSubkind(p as Record<string, unknown>);
      if (!subkind) continue;
      const pl = p as Record<string, unknown>;
      const exportSessionId = typeof pl.exportSessionId === 'string' ? pl.exportSessionId : undefined;
      const csvSha256 = typeof pl.csvSha256 === 'string' ? pl.csvSha256 : undefined;
      if (
        subkind === 'financial-export-audit' &&
        exportSessionId &&
        csvSha256 &&
        list.some(
          (e) =>
            e.subkind === 'financial-export-audit' &&
            e.exportSessionId === exportSessionId &&
            e.csvSha256 === csvSha256
        )
      ) {
        continue;
      }
      const code = typeof pl.code === 'string' ? pl.code : undefined;
      const message = typeof pl.message === 'string' ? pl.message : undefined;
      const denied = subkind === 'financial-export-denied';
      list.push({
        id: `fa_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        recordedAt: new Date().toISOString(),
        ingestOk: options.ingestOk,
        eventId: ev.eventId,
        occurredAt: ev.occurredAt,
        subkind,
        exportBatchId: typeof pl.exportBatchId === 'string' ? pl.exportBatchId : undefined,
        exportSessionId,
        outcome: typeof pl.outcome === 'string' ? pl.outcome : undefined,
        code,
        message,
        dataDomain: typeof pl.dataDomain === 'string' ? pl.dataDomain : undefined,
        dataSensitivity: typeof pl.dataSensitivity === 'string' ? pl.dataSensitivity : undefined,
        rowCount: typeof pl.rowCount === 'number' ? pl.rowCount : undefined,
        csvSha256,
        auditTraceId: typeof pl.auditTraceId === 'string' ? pl.auditTraceId : undefined,
        ingressTraceId: options.ingressTraceId,
        payloadSchemaVersion: typeof pl.schemaVersion === 'number' ? pl.schemaVersion : undefined,
        auditEventV1: buildUnifiedAuditEventV1({
          rulesTriggered: [],
          verdict: denied ? 'block' : 'allow',
          reason: message,
          correlation: {
            channel: 'financial_ingress',
            subkind,
            code,
            exportSessionId,
            auditTraceId: typeof pl.auditTraceId === 'string' ? pl.auditTraceId : undefined,
          },
          surfaceHint: 'financial_export',
        }),
      });
    }
    writeRaw(JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch {
    // ignore
  }
}

export function loadFinancialAuditStore(): FinancialAuditStoreEntry[] {
  try {
    const raw = readRaw();
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
