import type { G0ActionReportV1 } from './g0Types';

const STORAGE_KEY = 'intdone_g0_action_reports_v1';
const MAX_ENTRIES = 400;
let memoryRows: string | null = null;

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

export function appendG0ActionReport(report: G0ActionReportV1): void {
  try {
    const raw = readRaw();
    const list: G0ActionReportV1[] = raw ? JSON.parse(raw) : [];
    list.push(report);
    writeRaw(JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch {
    // ignore
  }
}

export function loadG0ActionReports(): G0ActionReportV1[] {
  try {
    const raw = readRaw();
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function downloadG0ReportJson(report: G0ActionReportV1): void {
  const exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intdeck-g0-${report.module}-${report.action}-${exportedAt.replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

