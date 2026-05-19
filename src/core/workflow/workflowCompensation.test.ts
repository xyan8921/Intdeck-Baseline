import { describe, expect, it } from 'vitest';
import { workflowFailureLogParamsFromContext, type WorkflowFailureCompensationContext } from './workflowCompensation';

describe('workflowFailureLogParamsFromContext', () => {
  it('matches WorkflowFailureLog fields from compensation context', () => {
    const ctx: WorkflowFailureCompensationContext = {
      workflowId: 'w1',
      scenarioId: 's1',
      failedStepIndex: 2,
      failedStepId: 'step-b',
      totalSteps: 5,
      completedStepOutputs: 2,
      errorMessage: 'x',
      stepOutputs: [],
      steps: [],
    };
    expect(workflowFailureLogParamsFromContext(ctx)).toEqual({
      workflowId: 'w1',
      scenarioId: 's1',
      failedStepIndex: 2,
      failedStepId: 'step-b',
      totalSteps: 5,
      completedStepOutputs: 2,
      errorMessage: 'x',
    });
  });
});
