/**
 * 执行链观测：模板 → 工作流 → Skill（Dev / 审计占位）
 */
import { ingestEventsWithTrace, orchestratorDrillFromExecution } from '@/core/backend-contract/traceLog';
import type { IngressEvent } from '@/core/backend-contract/types';

const STORAGE_KEY = 'intdone_execution_logs';
const MAX_ENTRIES = 200;

export interface ExecutionLogEntry {
  id: string;
  timestamp: string;
  /** 旧日志可能缺省，展示时按 template 处理 */
  executionPath?: 'template' | 'keyword-generic';
  /** `execute`（默认）| `undo`（E4 工作流栈撤销） */
  action?: 'execute' | 'undo';
  /** 撤销请求所带 token（仅 action=undo 时） */
  undoToken?: string;
  templateId: string;
  workflowId: string;
  skillIds: string[];
}

export function appendExecutionLog(entry: Omit<ExecutionLogEntry, 'id' | 'timestamp'>): void {
  try {
    const row: ExecutionLogEntry = {
      ...entry,
      id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list: ExecutionLogEntry[] = raw ? JSON.parse(raw) : [];
    list.push(row);
    const trimmed = list.slice(-MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

    // Stage B 前置：通过本地 Stub 记录后端契约 trace，不影响主链路。
    const event: IngressEvent = {
      eventId: row.id,
      occurredAt: row.timestamp,
      kind: 'execution',
      executionId: row.id,
      payload: {
        executionPath: row.executionPath ?? 'template',
        action: row.action ?? 'execute',
        templateId: row.templateId,
        workflowId: row.workflowId,
        skillIds: row.skillIds,
        ...(row.undoToken ? { undoToken: row.undoToken } : {}),
      },
    };
    void ingestEventsWithTrace([event]);
    void orchestratorDrillFromExecution({
      intentId: row.id,
      executionPath: row.executionPath ?? 'template',
      templateId: row.templateId,
    });
  } catch {
    /* ignore */
  }
}

export function loadExecutionLogs(): ExecutionLogEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
