import { describe, expect, it } from 'vitest';
import { loadBackendContractLogs, orchestratorDrillFromExecution } from './traceLog';

describe('traceLog orchestrator drill', () => {
  it('should append start/running/succeeded traces', async () => {
    const before = loadBackendContractLogs().length;
    await orchestratorDrillFromExecution({
      intentId: `intent_${Date.now()}`,
      executionPath: 'template',
      templateId: 'event-planning',
    });
    const afterLogs = loadBackendContractLogs();
    const delta = afterLogs.length - before;
    expect(delta).toBeGreaterThanOrEqual(3);
    const endpoints = afterLogs.slice(-3).map((x) => x.endpoint);
    expect(endpoints).toContain('startExecution');
    expect(endpoints.filter((x) => x === 'updateExecutionState').length).toBeGreaterThanOrEqual(2);
  });
});

