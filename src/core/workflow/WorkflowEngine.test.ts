import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWorkflowFailureLogs } from '../observability/workflowFailureLog';
import { MockRefundService } from '../skills/payment/MockRefundService';
import { WorkflowEngine } from './WorkflowEngine';
import type { Workflow } from './types';
import type { Skill } from '../skills/types';
import { createSystemMeta } from '../system/types';

const meta = createSystemMeta();

beforeEach(() => {
  try {
    localStorage.removeItem('intdone_workflow_failure_logs_v1');
  } catch {
    // ignore
  }
});

function mkWorkflow(stepCount: number): Workflow {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    id: `s${i}`,
    skillId: 'noop',
    inputTemplate: { prompt: '{{intent}}' },
  }));
  return {
    id: 'wf-test',
    scenarioId: 'sc-test',
    steps,
    metadata: {
      name: 'Test WF',
      description: 'test',
      outputFormat: 'markdown' as const,
      ethicalPrinciples: ['E4'],
    },
  };
}

const noopSkill: Skill = {
  id: 'noop',
  type: 'text',
  metadata: {
    name: 'Noop',
    description: 'test',
    ethicalPrinciples: ['E3'],
    requiresNetwork: false,
  },
  execute: async () => ({
    content: 'ok',
    format: 'text/plain',
    metadata: { skillId: 'noop', timestamp: Date.now() },
  }),
};

describe('WorkflowEngine E4 undo', () => {
  it('clears isComplete and rewinds step after one undo (multi-step)', async () => {
    const engine = new WorkflowEngine();
    engine.registerSkill(noopSkill);
    await engine.execute('hi', mkWorkflow(2), meta);
    const okDone = engine.getStatus();
    expect(okDone.isComplete).toBe(true);
    expect(okDone.stackClearedAfterFailure).toBe(false);
    expect(await engine.undo()).toBe(true);
    const s = engine.getStatus();
    expect(s.isComplete).toBe(false);
    expect(s.currentStep).toBe(0);
    expect(s.stepName).toBe('s0');
  });

  it('supports chained undos until stack empty', async () => {
    const engine = new WorkflowEngine();
    engine.registerSkill(noopSkill);
    await engine.execute('hi', mkWorkflow(2), meta);
    expect(await engine.undo()).toBe(true);
    expect(await engine.undo()).toBe(true);
    expect(await engine.undo()).toBe(false);
  });

  it('returns false when nothing to undo', async () => {
    const engine = new WorkflowEngine();
    expect(await engine.undo()).toBe(false);
  });

  it('resets operation stack on new execute', async () => {
    const engine = new WorkflowEngine();
    engine.registerSkill(noopSkill);
    await engine.execute('a', mkWorkflow(1), meta);
    expect(await engine.undo()).toBe(true);
    await engine.execute('b', mkWorkflow(1), meta);
    expect(engine.getStatus().isComplete).toBe(true);
    expect(await engine.undo()).toBe(true);
    expect(await engine.undo()).toBe(false);
  });

  it('clears operation stack when execute throws (no fallback)', async () => {
    const engine = new WorkflowEngine();
    const boomSkill: Skill = {
      ...noopSkill,
      id: 'boom',
      execute: async () => {
        throw new Error('boom');
      },
    };
    engine.registerSkill(boomSkill);
    const wf: Workflow = {
      id: 'wf-fail',
      scenarioId: 'sc-fail',
      steps: [{ id: 'only', skillId: 'boom', inputTemplate: { prompt: '{{intent}}' } }],
      metadata: {
        name: 'fail wf',
        description: 't',
        outputFormat: 'markdown' as const,
        ethicalPrinciples: ['E4'],
      },
    };
    await expect(engine.execute('hi', wf, meta)).rejects.toThrow(/no fallback strategy/);
    expect(engine.getStatus().stackClearedAfterFailure).toBe(true);
    expect(await engine.undo()).toBe(false);
    const fails = loadWorkflowFailureLogs();
    expect(fails.length).toBeGreaterThan(0);
    expect(fails[fails.length - 1].workflowId).toBe('wf-fail');
    expect(fails[fails.length - 1].failedStepId).toBe('only');
  });

  it('invokes compensation hooks with context aligned to workflow failure log', async () => {
    const engine = new WorkflowEngine();
    const boomSkill: Skill = {
      ...noopSkill,
      id: 'boom',
      execute: async () => {
        throw new Error('boom');
      },
    };
    engine.registerSkill(boomSkill);
    const seen: Array<{ workflowId: string; completedStepOutputs: number; failedStepId: string }> = [];
    engine.registerCompensationHook((ctx) => {
      seen.push({
        workflowId: ctx.workflowId,
        completedStepOutputs: ctx.completedStepOutputs,
        failedStepId: ctx.failedStepId,
      });
    });
    const wf: Workflow = {
      id: 'wf-hook',
      scenarioId: 'sc-hook',
      steps: [{ id: 'only', skillId: 'boom', inputTemplate: { prompt: '{{intent}}' } }],
      metadata: {
        name: 'hook wf',
        description: 't',
        outputFormat: 'markdown' as const,
        ethicalPrinciples: ['E4'],
      },
    };
    await expect(engine.execute('hi', wf, meta)).rejects.toThrow(/no fallback strategy/);
    expect(seen).toEqual([
      { workflowId: 'wf-hook', completedStepOutputs: 0, failedStepId: 'only' },
    ]);
    const last = loadWorkflowFailureLogs()[loadWorkflowFailureLogs().length - 1];
    expect(last.workflowId).toBe('wf-hook');
    expect(last.completedStepOutputs).toBe(0);
  });

  it('passes prior step outputs into compensation context when failure is on a later step', async () => {
    const engine = new WorkflowEngine();
    const boomSkill: Skill = {
      ...noopSkill,
      id: 'boom',
      execute: async () => {
        throw new Error('late');
      },
    };
    engine.registerSkill(noopSkill);
    engine.registerSkill(boomSkill);
    let ctxLen = 0;
    let failedIdx = -1;
    engine.registerCompensationHook((ctx) => {
      ctxLen = ctx.stepOutputs.length;
      failedIdx = ctx.failedStepIndex;
    });
    const wf: Workflow = {
      id: 'wf-2',
      scenarioId: 'sc-2',
      steps: [
        { id: 'a', skillId: 'noop', inputTemplate: { prompt: '{{intent}}' } },
        { id: 'b', skillId: 'boom', inputTemplate: { prompt: '{{intent}}' } },
      ],
      metadata: {
        name: 'two',
        description: 't',
        outputFormat: 'markdown' as const,
        ethicalPrinciples: ['E4'],
      },
    };
    await expect(engine.execute('hi', wf, meta)).rejects.toThrow(/no fallback strategy/);
    expect(ctxLen).toBe(1);
    expect(failedIdx).toBe(1);
    const logs = loadWorkflowFailureLogs();
    expect(logs[logs.length - 1]?.completedStepOutputs).toBe(1);
  });

  it('runs registered hooks before built-in payment refund', async () => {
    const order: string[] = [];
    const ts = Date.now();
    const token = `pay_undo_${ts}_testabcd`;
    const paySkill: Skill = {
      id: 'pay',
      type: 'payment',
      metadata: {
        name: 'p',
        description: 'd',
        ethicalPrinciples: ['E4'],
        requiresNetwork: false,
      },
      execute: async () => ({
        content: { undoToken: token },
        format: 'payment',
        metadata: { skillId: 'pay', timestamp: Date.now() },
      }),
    };
    const boomSkill: Skill = {
      ...noopSkill,
      id: 'boom2',
      execute: async () => {
        throw new Error('after-pay');
      },
    };
    const engine = new WorkflowEngine();
    engine.registerSkill(paySkill);
    engine.registerSkill(boomSkill);
    const refund = new MockRefundService();
    const undoSpy = vi.spyOn(refund, 'undo');
    engine.setRefundService(refund);
    engine.registerCompensationHook(() => {
      order.push('hook');
    });
    const wf: Workflow = {
      id: 'wf-pay',
      scenarioId: 'sc-pay',
      steps: [
        { id: 'p1', skillId: 'pay', inputTemplate: { prompt: '{{intent}}' } },
        { id: 'p2', skillId: 'boom2', inputTemplate: { prompt: '{{intent}}' } },
      ],
      metadata: {
        name: 'pay fail',
        description: 't',
        outputFormat: 'markdown' as const,
        ethicalPrinciples: ['E4'],
      },
    };
    await expect(engine.execute('hi', wf, meta)).rejects.toThrow(/no fallback strategy/);
    expect(order).toEqual(['hook']);
    expect(undoSpy).toHaveBeenCalledWith(token);
    undoSpy.mockRestore();
  });

  it('continues other hooks when one hook throws', async () => {
    const engine = new WorkflowEngine();
    const boomSkill: Skill = {
      ...noopSkill,
      id: 'boom3',
      execute: async () => {
        throw new Error('x');
      },
    };
    engine.registerSkill(boomSkill);
    const runs: string[] = [];
    engine.registerCompensationHook(() => {
      runs.push('a');
      throw new Error('hook fail');
    });
    engine.registerCompensationHook(() => {
      runs.push('b');
    });
    const wf: Workflow = {
      id: 'wf-throw',
      scenarioId: 'sc-throw',
      steps: [{ id: 'one', skillId: 'boom3', inputTemplate: { prompt: '{{intent}}' } }],
      metadata: {
        name: 't',
        description: 't',
        outputFormat: 'markdown' as const,
        ethicalPrinciples: ['E4'],
      },
    };
    await expect(engine.execute('hi', wf, meta)).rejects.toThrow(/no fallback strategy/);
    expect(runs).toEqual(['a', 'b']);
  });
});
