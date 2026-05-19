import { describe, expect, it } from 'vitest';
import { buildDagOrder, WorkflowCycleError } from './dagSort';
import { WorkflowEngine } from './WorkflowEngine';
import { createSystemMeta } from '../system/types';
import type { Workflow, WorkflowStep } from './types';
import type { Skill, SkillInput, SkillOutput } from '../skills/types';

// ── buildDagOrder（纯函数单元测试）────────────────────────────────────────────

describe('buildDagOrder — 纯函数', () => {
  function makeSteps(defs: Array<{ id: string; dependsOn?: string[] }>): WorkflowStep[] {
    return defs.map(({ id, dependsOn }) => ({
      id,
      skillId: id,
      inputTemplate: {},
      dependsOn,
    }));
  }

  it('无 dependsOn：保持原数组顺序', () => {
    const steps = makeSteps([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const result = buildDagOrder(steps);
    expect(result.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('空数组 → 空数组', () => {
    expect(buildDagOrder([])).toEqual([]);
  });

  it('线性链：a → b → c，定义顺序 [c, b, a] → 输出 [a, b, c]', () => {
    const steps = makeSteps([
      { id: 'c', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'a' },
    ]);
    const result = buildDagOrder(steps);
    expect(result.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('菱形依赖：b 和 c 依赖 a，d 依赖 b 和 c', () => {
    // a → b → d
    // a → c → d
    const steps = makeSteps([
      { id: 'a' },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['a'] },
      { id: 'd', dependsOn: ['b', 'c'] },
    ]);
    const result = buildDagOrder(steps);
    const idx = (id: string) => result.findIndex((s) => s.id === id);
    // a 必须在 b、c 之前；b、c 必须在 d 之前
    expect(idx('a')).toBeLessThan(idx('b'));
    expect(idx('a')).toBeLessThan(idx('c'));
    expect(idx('b')).toBeLessThan(idx('d'));
    expect(idx('c')).toBeLessThan(idx('d'));
    expect(result).toHaveLength(4);
  });

  it('直接循环：a 依赖 b，b 依赖 a → WorkflowCycleError', () => {
    const steps = makeSteps([
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
    ]);
    expect(() => buildDagOrder(steps)).toThrow(WorkflowCycleError);
    expect(() => buildDagOrder(steps)).toThrow(/循环依赖/);
  });

  it('三步环路：a→b→c→a → WorkflowCycleError', () => {
    const steps = makeSteps([
      { id: 'a', dependsOn: ['c'] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['b'] },
    ]);
    expect(() => buildDagOrder(steps)).toThrow(WorkflowCycleError);
  });

  it('依赖未知步骤 → Error（非 WorkflowCycleError）', () => {
    const steps = makeSteps([{ id: 'a', dependsOn: ['nonexistent'] }]);
    expect(() => buildDagOrder(steps)).toThrow(/未知步骤/);
    expect(() => buildDagOrder(steps)).not.toThrow(WorkflowCycleError);
  });

  it('WorkflowCycleError.cycleStepIds 包含环路步骤', () => {
    const steps = makeSteps([
      { id: 'x', dependsOn: ['y'] },
      { id: 'y', dependsOn: ['x'] },
      { id: 'z' },
    ]);
    let err: WorkflowCycleError | undefined;
    try {
      buildDagOrder(steps);
    } catch (e) {
      if (e instanceof WorkflowCycleError) err = e;
    }
    expect(err).toBeDefined();
    expect(err!.cycleStepIds).toContain('x');
    expect(err!.cycleStepIds).toContain('y');
    // z 不在环中
    expect(err!.cycleStepIds).not.toContain('z');
  });
});

// ── WorkflowEngine 拓扑执行顺序集成测试 ──────────────────────────────────────

const meta = createSystemMeta();

function makeOrderCapturingSkill(id: string, execOrder: string[]): Skill {
  return {
    id,
    type: 'text',
    metadata: { name: id, description: '', ethicalPrinciples: ['E3'], requiresNetwork: false },
    execute: async (_input: SkillInput): Promise<SkillOutput> => {
      execOrder.push(id);
      return {
        content: `output-${id}`,
        format: 'text/plain',
        metadata: { skillId: id, timestamp: Date.now() },
      };
    },
  };
}

describe('WorkflowEngine — DAG 拓扑排序执行（Sprint E）', () => {
  it('无 dependsOn：执行顺序与 steps 数组一致', async () => {
    const order: string[] = [];
    const engine = new WorkflowEngine();
    engine.registerSkill(makeOrderCapturingSkill('sk1', order));
    engine.registerSkill(makeOrderCapturingSkill('sk2', order));
    engine.registerSkill(makeOrderCapturingSkill('sk3', order));

    const wf: Workflow = {
      id: 'wf-linear',
      scenarioId: 'sc',
      steps: [
        { id: 's1', skillId: 'sk1', inputTemplate: {} },
        { id: 's2', skillId: 'sk2', inputTemplate: {} },
        { id: 's3', skillId: 'sk3', inputTemplate: {} },
      ],
      metadata: { name: 'linear', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await engine.execute('test', wf, meta);
    expect(order).toEqual(['sk1', 'sk2', 'sk3']);
  });

  it('dependsOn 重排：steps 定义逆序，但执行按依赖顺序', async () => {
    const order: string[] = [];
    const engine = new WorkflowEngine();
    engine.registerSkill(makeOrderCapturingSkill('sk1', order));
    engine.registerSkill(makeOrderCapturingSkill('sk2', order));
    engine.registerSkill(makeOrderCapturingSkill('sk3', order));

    // 定义顺序：s3 → s2 → s1，但依赖链是 s1 → s2 → s3
    const wf: Workflow = {
      id: 'wf-reorder',
      scenarioId: 'sc',
      steps: [
        { id: 's3', skillId: 'sk3', inputTemplate: {}, dependsOn: ['s2'] },
        { id: 's2', skillId: 'sk2', inputTemplate: {}, dependsOn: ['s1'] },
        { id: 's1', skillId: 'sk1', inputTemplate: {} },
      ],
      metadata: { name: 'reorder', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await engine.execute('test', wf, meta);
    expect(order).toEqual(['sk1', 'sk2', 'sk3']);
  });

  it('循环依赖 → execute() 抛 WorkflowCycleError', async () => {
    const engine = new WorkflowEngine();
    const sk: Skill = {
      id: 'sk',
      type: 'text',
      metadata: { name: 'sk', description: '', ethicalPrinciples: ['E3'], requiresNetwork: false },
      execute: async () => ({ content: '', format: 'text/plain', metadata: { skillId: 'sk', timestamp: 0 } }),
    };
    engine.registerSkill(sk);

    const wf: Workflow = {
      id: 'wf-cycle',
      scenarioId: 'sc',
      steps: [
        { id: 'a', skillId: 'sk', inputTemplate: {}, dependsOn: ['b'] },
        { id: 'b', skillId: 'sk', inputTemplate: {}, dependsOn: ['a'] },
      ],
      metadata: { name: 'cycle', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await expect(engine.execute('test', wf, meta)).rejects.toThrow(WorkflowCycleError);
  });

  it('dependsOn + dataFlowMap 协同：后步骤取到前步骤输出', async () => {
    const engine = new WorkflowEngine();
    const capturedInputs: SkillInput[] = [];

    const sk1: Skill = {
      id: 'sk1',
      type: 'text',
      metadata: { name: 'sk1', description: '', ethicalPrinciples: ['E3'], requiresNetwork: false },
      execute: async () => ({
        content: 'hello-from-s1',
        format: 'text/plain',
        metadata: { skillId: 'sk1', timestamp: 0 },
      }),
    };
    const sk2: Skill = {
      id: 'sk2',
      type: 'text',
      metadata: { name: 'sk2', description: '', ethicalPrinciples: ['E3'], requiresNetwork: false },
      execute: async (input) => {
        capturedInputs.push({ ...input });
        return { content: 'ok', format: 'text/plain', metadata: { skillId: 'sk2', timestamp: 0 } };
      },
    };

    engine.registerSkill(sk1);
    engine.registerSkill(sk2);

    // 定义顺序反转，但 dependsOn 保证 s2 在 s1 之后执行
    const wf: Workflow = {
      id: 'wf-combo',
      scenarioId: 'sc',
      steps: [
        {
          id: 's2',
          skillId: 'sk2',
          inputTemplate: {},
          dependsOn: ['s1'],
          dataFlowMap: { fromPrev: { stepId: 's1', outputKey: 'content' } },
        },
        { id: 's1', skillId: 'sk1', inputTemplate: {} },
      ],
      metadata: { name: 'combo', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await engine.execute('test', wf, meta);
    expect(capturedInputs[0].fromPrev).toBe('hello-from-s1');
  });
});

// ── WorkflowEngine — strictDataFlow 模式 ──────────────────────────────────────

describe('WorkflowEngine — strictDataFlow（Sprint E）', () => {
  function makePassThroughSkill(id: string): Skill {
    return {
      id,
      type: 'text',
      metadata: { name: id, description: '', ethicalPrinciples: ['E3'], requiresNetwork: false },
      execute: async () => ({
        content: `out-${id}`,
        format: 'text/plain',
        metadata: { skillId: id, timestamp: 0 },
      }),
    };
  }

  it('strictDataFlow=false（默认）：unresolved 绑定静默跳过，执行成功', async () => {
    const engine = new WorkflowEngine();
    engine.registerSkill(makePassThroughSkill('sk1'));

    const wf: Workflow = {
      id: 'wf-loose',
      scenarioId: 'sc',
      steps: [
        {
          id: 's1',
          skillId: 'sk1',
          inputTemplate: {},
          dataFlowMap: { ghost: { stepId: 'no-such-step', outputKey: 'content' } },
        },
      ],
      metadata: { name: 'loose', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await expect(engine.execute('go', wf, meta)).resolves.toBeDefined();
  });

  it('strictDataFlow=true + unresolved 绑定 → 抛错', async () => {
    const engine = new WorkflowEngine();
    engine.registerSkill(makePassThroughSkill('sk1'));

    const wf: Workflow = {
      id: 'wf-strict',
      scenarioId: 'sc',
      steps: [
        {
          id: 's1',
          skillId: 'sk1',
          inputTemplate: {},
          dataFlowMap: { ghost: { stepId: 'no-such-step', outputKey: 'content' } },
        },
      ],
      metadata: { name: 'strict', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await expect(engine.execute('go', wf, meta, { strictDataFlow: true })).rejects.toThrow(
      /strictDataFlow.*ghost/
    );
  });

  it('strictDataFlow=true + 全部 resolved → 执行成功', async () => {
    const engine = new WorkflowEngine();
    engine.registerSkill(makePassThroughSkill('sk1'));
    engine.registerSkill(makePassThroughSkill('sk2'));

    const wf: Workflow = {
      id: 'wf-strict-ok',
      scenarioId: 'sc',
      steps: [
        { id: 's1', skillId: 'sk1', inputTemplate: {} },
        {
          id: 's2',
          skillId: 'sk2',
          inputTemplate: {},
          dataFlowMap: { fromS1: { stepId: 's1', outputKey: 'content' } },
        },
      ],
      metadata: { name: 'strict-ok', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await expect(engine.execute('go', wf, meta, { strictDataFlow: true })).resolves.toBeDefined();
  });
});
