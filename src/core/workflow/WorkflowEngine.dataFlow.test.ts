import { describe, expect, it } from 'vitest';
import { WorkflowEngine } from './WorkflowEngine';
import { createSystemMeta } from '../system/types';
import type { Workflow } from './types';
import type { Skill, SkillInput, SkillOutput } from '../skills/types';

const meta = createSystemMeta();

/** Skill 工厂：执行时把收到的 SkillInput 记录到 capturedInputs，返回指定 output */
function makeCapturingSkill(id: string, outputContent: unknown = 'ok'): {
  skill: Skill;
  capturedInputs: SkillInput[];
} {
  const capturedInputs: SkillInput[] = [];
  const skill: Skill = {
    id,
    type: 'text',
    metadata: { name: id, description: '', ethicalPrinciples: ['E3'], requiresNetwork: false },
    execute: async (input) => {
      capturedInputs.push({ ...input });
      return {
        content: outputContent,
        format: 'text/plain',
        metadata: { skillId: id, timestamp: Date.now() },
      };
    },
  };
  return { skill, capturedInputs };
}

describe('WorkflowEngine — DAG stepDataFlow（Sprint D）', () => {
  it('无 dataFlowMap 时保持原有行为', async () => {
    const engine = new WorkflowEngine();
    const { skill, capturedInputs } = makeCapturingSkill('s1');
    engine.registerSkill(skill);

    const wf: Workflow = {
      id: 'wf-plain',
      scenarioId: 'sc',
      steps: [{ id: 'step1', skillId: 's1', inputTemplate: { extra: 'static-val' } }],
      metadata: { name: 'plain', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };
    await engine.execute('hello', wf, meta);
    expect(capturedInputs[0].extra).toBe('static-val');
    expect(capturedInputs[0].prompt).toBe('hello');
  });

  it('dataFlowMap 将前步输出字段注入后步输入', async () => {
    const engine = new WorkflowEngine();

    // step1 输出 content='generated-title'
    const { skill: sk1 } = makeCapturingSkill('sk1', 'generated-title');
    // step2 将从 step1.content 取值注入 titleFromPrev
    const { skill: sk2, capturedInputs: caps2 } = makeCapturingSkill('sk2', 'body');

    engine.registerSkill(sk1);
    engine.registerSkill(sk2);

    const wf: Workflow = {
      id: 'wf-flow',
      scenarioId: 'sc',
      steps: [
        { id: 'step1', skillId: 'sk1', inputTemplate: {} },
        {
          id: 'step2',
          skillId: 'sk2',
          inputTemplate: {},
          dataFlowMap: {
            titleFromPrev: { stepId: 'step1', outputKey: 'content' },
          },
        },
      ],
      metadata: { name: 'flow', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await engine.execute('go', wf, meta);

    expect(caps2[0].titleFromPrev).toBe('generated-title');
  });

  it('dataFlowMap 覆盖 inputTemplate 同名键', async () => {
    const engine = new WorkflowEngine();

    const { skill: sk1 } = makeCapturingSkill('sk1', 'dynamic-val');
    const { skill: sk2, capturedInputs: caps2 } = makeCapturingSkill('sk2');

    engine.registerSkill(sk1);
    engine.registerSkill(sk2);

    const wf: Workflow = {
      id: 'wf-override',
      scenarioId: 'sc',
      steps: [
        { id: 'step1', skillId: 'sk1', inputTemplate: {} },
        {
          id: 'step2',
          skillId: 'sk2',
          // 静态 title='static'，但 dataFlowMap 绑定同名 title → step1.content
          inputTemplate: { title: 'static' },
          dataFlowMap: {
            title: { stepId: 'step1', outputKey: 'content' },
          },
        },
      ],
      metadata: { name: 'ov', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await engine.execute('go', wf, meta);
    // 动态绑定应覆盖静态模板值
    expect(caps2[0].title).toBe('dynamic-val');
  });

  it('来源步骤未执行时绑定忽略（unresolved 不注入）', async () => {
    const engine = new WorkflowEngine();
    const { skill, capturedInputs } = makeCapturingSkill('sk1');
    engine.registerSkill(skill);

    const wf: Workflow = {
      id: 'wf-miss',
      scenarioId: 'sc',
      steps: [
        {
          id: 'step1',
          skillId: 'sk1',
          inputTemplate: { fallback: 'default' },
          dataFlowMap: {
            fromMissing: { stepId: 'non-existent-step', outputKey: 'content' },
          },
        },
      ],
      metadata: { name: 'miss', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await engine.execute('go', wf, meta);
    // unresolved 绑定不注入，静态 fallback 保留
    expect(capturedInputs[0]).not.toHaveProperty('fromMissing');
    expect(capturedInputs[0].fallback).toBe('default');
  });

  it('三步流水线：step3 能取到 step1 和 step2 的输出', async () => {
    const engine = new WorkflowEngine();
    const { skill: sk1 } = makeCapturingSkill('sk1', 'alpha');
    const { skill: sk2 } = makeCapturingSkill('sk2', 'beta');
    const { skill: sk3, capturedInputs: caps3 } = makeCapturingSkill('sk3', 'gamma');

    engine.registerSkill(sk1);
    engine.registerSkill(sk2);
    engine.registerSkill(sk3);

    const wf: Workflow = {
      id: 'wf-3',
      scenarioId: 'sc',
      steps: [
        { id: 's1', skillId: 'sk1', inputTemplate: {} },
        { id: 's2', skillId: 'sk2', inputTemplate: {} },
        {
          id: 's3',
          skillId: 'sk3',
          inputTemplate: {},
          dataFlowMap: {
            fromS1: { stepId: 's1', outputKey: 'content' },
            fromS2: { stepId: 's2', outputKey: 'content' },
          },
        },
      ],
      metadata: { name: '3step', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await engine.execute('go', wf, meta);
    expect(caps3[0].fromS1).toBe('alpha');
    expect(caps3[0].fromS2).toBe('beta');
  });

  it('dataFlowMap 可绑定 metadata 字段（如 skillId）', async () => {
    const engine = new WorkflowEngine();
    const { skill: sk1 } = makeCapturingSkill('sk1', 'x');
    const { skill: sk2, capturedInputs: caps2 } = makeCapturingSkill('sk2');

    engine.registerSkill(sk1);
    engine.registerSkill(sk2);

    const wf: Workflow = {
      id: 'wf-meta',
      scenarioId: 'sc',
      steps: [
        { id: 's1', skillId: 'sk1', inputTemplate: {} },
        {
          id: 's2',
          skillId: 'sk2',
          inputTemplate: {},
          // skillId 字段由 SkillOutput.metadata.skillId 展开到 executedOutputs
          dataFlowMap: { prevSkillId: { stepId: 's1', outputKey: 'skillId' } },
        },
      ],
      metadata: { name: 'meta-bind', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };

    await engine.execute('go', wf, meta);
    expect(caps2[0].prevSkillId).toBe('sk1');
  });
});

describe('WorkflowEngine — 现有行为回归', () => {
  it('无 dataFlowMap 工作流执行结果与 Sprint C 前一致', async () => {
    const engine = new WorkflowEngine();
    const outputs: SkillOutput[] = [];
    const skill: Skill = {
      id: 'noop',
      type: 'text',
      metadata: { name: 'noop', description: '', ethicalPrinciples: ['E4'], requiresNetwork: false },
      execute: async () => {
        const out: SkillOutput = { content: 'ok', format: 'text/plain', metadata: { skillId: 'noop', timestamp: 1 } };
        outputs.push(out);
        return out;
      },
    };
    engine.registerSkill(skill);
    const wf: Workflow = {
      id: 'wf-reg',
      scenarioId: 'sc',
      steps: [
        { id: 's1', skillId: 'noop', inputTemplate: { prompt: '{{intent}}' } },
        { id: 's2', skillId: 'noop', inputTemplate: { prompt: '{{intent}}' } },
      ],
      metadata: { name: 'reg', description: '', outputFormat: 'markdown', ethicalPrinciples: ['E4'] },
    };
    const d = await engine.execute('hello', wf, meta);
    expect(outputs).toHaveLength(2);
    expect(d.metadata.workflowId).toBe('wf-reg');
    expect(engine.getStatus().isComplete).toBe(true);
  });
});
