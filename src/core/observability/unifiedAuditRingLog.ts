/**
 * 轻量环形缓冲：出站 / E4 / 财务伦理等经 `LocalEthicsGuard` 的审计事件（与 Core AI 行内 `auditEventV1` 互补）。
 */
import type { UnifiedAuditEventV1 } from './unifiedAuditSchema';

const STORAGE_KEY = 'intdone_unified_audit_ring_v1';
const MAX_ENTRIES = 300;
let memoryRows: string | null = null;

export interface UnifiedAuditRingEntry {
  id: string;
  recordedAt: string;
  auditEventV1: UnifiedAuditEventV1;
}

function readRaw(): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(STORAGE_KEY);
  }
  return memoryRows;
}

function writeRaw(value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, value);
    return;
  }
  memoryRows = value;
}

export function appendUnifiedAuditRingEvent(auditEventV1: UnifiedAuditEventV1): void {
  try {
    const raw = readRaw();
    const list: UnifiedAuditRingEntry[] = raw ? JSON.parse(raw) : [];
    list.push({
      id: `uar_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      recordedAt: new Date().toISOString(),
      auditEventV1,
    });
    writeRaw(JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch {
    // ignore
  }
}

export function loadUnifiedAuditRing(): UnifiedAuditRingEntry[] {
  try {
    const raw = readRaw();
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
