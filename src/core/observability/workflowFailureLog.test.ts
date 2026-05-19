import { afterEach, describe, expect, it } from 'vitest';
import { appendWorkflowFailureLog, loadWorkflowFailureLogs } from './workflowFailureLog';

const KEY = 'intdone_workflow_failure_logs_v1';

describe('workflowFailureLog', () => {
  afterEach(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  });

  it('appends and loads failure entries', () => {
    appendWorkflowFailureLog({
      workflowId: 'wf1',
      scenarioId: 'sc1',
      failedStepIndex: 0,
      failedStepId: 's0',
      totalSteps: 2,
      completedStepOutputs: 0,
      errorMessage: 'boom',
    });
    const rows = loadWorkflowFailureLogs();
    expect(rows).toHaveLength(1);
    expect(rows[0].workflowId).toBe('wf1');
    expect(rows[0].schemaVersion).toBe(1);
    expect(rows[0].stackClearedAfterFailure).toBe(true);
  });
});
