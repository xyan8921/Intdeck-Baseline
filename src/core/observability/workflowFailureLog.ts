/**
 * E4：工作流执行失败结构化记录（本地持久化，供 Dev 回放；不等同于业务审计落库）
 */
const STORAGE_KEY = 'intdone_workflow_failure_logs_v1';
const MAX_ENTRIES = 100;
let memoryRows: string | null = null;

export interface WorkflowFailureLogEntry {
  id: string;
  timestamp: string;
  /** 事件包版本，升级字段时递增 */
  schemaVersion: 1;
  workflowId: string;
  scenarioId: string;
  failedStepIndex: number;
  failedStepId: string;
  totalSteps: number;
  /** 已成功并入 `stepOutputs` 的步骤数（失败所在步未计入） */
  completedStepOutputs: number;
  errorMessage: string;
  stackClearedAfterFailure: true;
}

function getItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(key);
  }
  return key === STORAGE_KEY ? memoryRows : null;
}

function setItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, value);
    return;
  }
  if (key === STORAGE_KEY) {
    memoryRows = value;
  }
}

export function appendWorkflowFailureLog(
  params: Omit<
    WorkflowFailureLogEntry,
    'id' | 'timestamp' | 'schemaVersion' | 'stackClearedAfterFailure'
  >
): void {
  try {
    const row: WorkflowFailureLogEntry = {
      id: `wfail_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      schemaVersion: 1,
      stackClearedAfterFailure: true,
      ...params,
    };
    const raw = getItem(STORAGE_KEY);
    const list: WorkflowFailureLogEntry[] = raw ? JSON.parse(raw) : [];
    list.push(row);
    setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch {
    // ignore
  }
}

export function loadWorkflowFailureLogs(): WorkflowFailureLogEntry[] {
  try {
    const raw = getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
