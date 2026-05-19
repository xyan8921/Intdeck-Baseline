import type { G0ActionReportV1 } from '../governance/g0Types';
import { UNIFIED_AUDIT_SCHEMA_VERSION } from '../observability/unifiedAuditSchema';
import { sha256HexOfUtf8TextCompat } from './sha256Compat';
import type {
  ExperienceExportPackageV1,
  ExperienceItemV1,
  IntdeckAgentRuntimeManifestV1,
} from './experienceTypes';
import { EXPERIENCE_SCHEMA_VERSION } from './experienceTypes';

const STORAGE_KEY = 'intdeck_experience_items_v1';
const MAX_ENTRIES = 800;
let memoryRows: string | null = null;

function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return '"<unserializable>"';
  }
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

export function loadExperienceItems(): ExperienceItemV1[] {
  try {
    const raw = readRaw();
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as ExperienceItemV1[]) : [];
  } catch {
    return [];
  }
}

export function appendExperienceItem(item: ExperienceItemV1): void {
  try {
    const raw = readRaw();
    const list: ExperienceItemV1[] = raw ? JSON.parse(raw) : [];
    list.push(item);
    writeRaw(JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch {
    // ignore
  }
}

/**
 * v0：用 G0 Action Report 直接生成 ExperienceItem（蒸馏/模板化后置）。
 *
 * 审计锁最小口径：
 * - reportSha256：对原始报告的稳定 hash；
 * - summary/auditEventV1：与 G0/统一 audit 同源，用于“可证明来自审计链”。
 */
export async function appendExperienceFromG0ActionReport(report: G0ActionReportV1): Promise<ExperienceItemV1> {
  const createdAt = new Date().toISOString();
  const reportSha256 = await sha256HexOfUtf8TextCompat(safeJsonStringify(report));
  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const item: ExperienceItemV1 = {
    schemaVersion: EXPERIENCE_SCHEMA_VERSION,
    id,
    createdAt,
    source: {
      kind: 'g0_action_report_v1',
      g0ReportId: report.id,
      recordedAt: report.recordedAt,
      module: report.module,
      action: report.action,
      reportSha256,
    },
    correlation: report.correlation,
    summary: report.summary,
    auditEventV1: report.auditEventV1,
    inputSnapshot: report.inputSnapshot,
    outputSnapshot: report.outputSnapshot,
  };

  appendExperienceItem(item);
  return item;
}

export function buildExperienceExportPackage(
  items: ExperienceItemV1[],
  options?: { intdeckAgentRuntime?: IntdeckAgentRuntimeManifestV1 }
): ExperienceExportPackageV1 {
  const exportedAt = new Date().toISOString();
  return {
    manifest: {
      schemaVersion: 1,
      exportedAt,
      itemCount: items.length,
      unifiedAuditSchemaVersion: UNIFIED_AUDIT_SCHEMA_VERSION,
      experienceSchemaVersion: EXPERIENCE_SCHEMA_VERSION,
      ...(options?.intdeckAgentRuntime ? { intdeckAgentRuntime: options.intdeckAgentRuntime } : {}),
    },
    items,
  };
}

export function downloadExperienceExportJson(pkg: ExperienceExportPackageV1): void {
  const exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intdeck-experience-export-${exportedAt.replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

