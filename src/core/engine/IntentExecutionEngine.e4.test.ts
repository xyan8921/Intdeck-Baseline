import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Workflow } from '../workflow/types';
import type { Skill } from '../skills/types';
import { createSystemMeta } from '../system/types';

function mkWorkflow(stepCount: number): Workflow {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    id: `s${i}`,
    skillId: 'noop',
    inputTemplate: { prompt: '{{intent}}' },
  }));
  return {
    id: 'wf-e4',
    scenarioId: 'sc-e4',
    steps,
    metadata: {
      name: 'E4 test',
      description: 't',
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
    description: 't',
    ethicalPrinciples: ['E3'],
    requiresNetwork: false,
  },
  execute: async () => ({
    content: 'ok',
    format: 'text/plain',
    metadata: { skillId: 'noop', timestamp: Date.now() },
  }),
};

describe('IntentExecutionEngine E4 undo + token binding', () => {
  let appendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    const logMod = await import('../observability/executionLog');
    appendSpy = vi.spyOn(logMod, 'appendExecutionLog').mockImplementation(() => {});
  });

  afterEach(() => {
    appendSpy.mockRestore();
  });

  it('rejects undo when token does not match last deliverable', async () => {
    const { IntentExecutionEngine } = await import('./IntentExecutionEngine');
    const engine = new IntentExecutionEngine(createSystemMeta());
    engine.registerSkill(noopSkill);
    const wf = mkWorkflow(1);
    const d = await engine.execute('hi', wf);
    const token = d.metadata.undoToken;
    expect(await engine.undo(`undo-other-${Date.now()}-x`)).toBe(false);
    expect(await engine.undo(token)).toBe(true);
  });

  it('rejects undo after a new run clears the binding', async () => {
    const { IntentExecutionEngine } = await import('./IntentExecutionEngine');
    const engine = new IntentExecutionEngine(createSystemMeta());
    engine.registerSkill(noopSkill);
    const wf = mkWorkflow(1);
    const d1 = await engine.execute('a', wf);
    const t1 = d1.metadata.undoToken;
    const t2 = (await engine.execute('b', wf)).metadata.undoToken;
    expect(t1).not.toBe(t2);
    expect(await engine.undo(t1)).toBe(false);
    expect(await engine.undo(t2)).toBe(true);
  });

  it('chains undo with the same token while binding unchanged', async () => {
    const { IntentExecutionEngine } = await import('./IntentExecutionEngine');
    const engine = new IntentExecutionEngine(createSystemMeta());
    engine.registerSkill(noopSkill);
    const wf = mkWorkflow(2);
    const d = await engine.execute('hi', wf);
    const token = d.metadata.undoToken;
    expect(await engine.undo(token)).toBe(true);
    expect(await engine.undo(token)).toBe(true);
    expect(await engine.undo(token)).toBe(false);
  });

  it('appendExecutionLog receives undo after successful pop', async () => {
    const { IntentExecutionEngine } = await import('./IntentExecutionEngine');
    const engine = new IntentExecutionEngine(createSystemMeta());
    engine.registerSkill(noopSkill);
    const wf = mkWorkflow(1);
    const d = await engine.execute('hi', wf);
    appendSpy.mockClear();
    await engine.undo('undo-not-bound-xyz');
    expect(appendSpy).not.toHaveBeenCalled();
    await engine.undo(d.metadata.undoToken);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'undo', undoToken: d.metadata.undoToken })
    );
  });
});
