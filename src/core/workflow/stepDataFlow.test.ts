import { describe, expect, it } from 'vitest';
import {
  mergeStepInputs,
  resolveStepInput,
  type ExecutedStepOutputs,
  type WorkflowStepDataFlowMap,
} from './stepDataFlow';

describe('resolveStepInput — 基本解析', () => {
  it('空 dataFlowMap → resolved={}, unresolved=[]', () => {
    const r = resolveStepInput({}, {});
    expect(r.resolved).toEqual({});
    expect(r.unresolved).toHaveLength(0);
  });

  it('单字段成功解析', () => {
    const map: WorkflowStepDataFlowMap = {
      title: { stepId: 'step-1', outputKey: 'title' },
    };
    const outputs: ExecutedStepOutputs = {
      'step-1': { title: '主标题', body: '...' },
    };
    const r = resolveStepInput(map, outputs);
    expect(r.resolved.title).toBe('主标题');
    expect(r.unresolved).toHaveLength(0);
  });

  it('多字段跨步骤解析', () => {
    const map: WorkflowStepDataFlowMap = {
      intro: { stepId: 'step-a', outputKey: 'intro' },
      summary: { stepId: 'step-b', outputKey: 'summary' },
    };
    const outputs: ExecutedStepOutputs = {
      'step-a': { intro: '开篇', foo: 'x' },
      'step-b': { summary: '结语', bar: 'y' },
    };
    const r = resolveStepInput(map, outputs);
    expect(r.resolved.intro).toBe('开篇');
    expect(r.resolved.summary).toBe('结语');
    expect(r.unresolved).toHaveLength(0);
  });
});

describe('resolveStepInput — 未解析情况', () => {
  it('来源步骤未执行 → unresolved', () => {
    const map: WorkflowStepDataFlowMap = {
      data: { stepId: 'missing-step', outputKey: 'data' },
    };
    const r = resolveStepInput(map, {});
    expect(r.unresolved).toContain('data');
    expect(r.resolved).not.toHaveProperty('data');
  });

  it('步骤存在但字段不存在 → unresolved', () => {
    const map: WorkflowStepDataFlowMap = {
      score: { stepId: 'step-1', outputKey: 'score' },
    };
    const outputs: ExecutedStepOutputs = {
      'step-1': { name: 'Alice' },
    };
    const r = resolveStepInput(map, outputs);
    expect(r.unresolved).toContain('score');
  });

  it('部分解析成功，部分失败', () => {
    const map: WorkflowStepDataFlowMap = {
      ok: { stepId: 'step-1', outputKey: 'present' },
      missing: { stepId: 'step-1', outputKey: 'absent' },
    };
    const outputs: ExecutedStepOutputs = {
      'step-1': { present: 42 },
    };
    const r = resolveStepInput(map, outputs);
    expect(r.resolved.ok).toBe(42);
    expect(r.unresolved).toContain('missing');
    expect(r.unresolved).not.toContain('ok');
  });
});

describe('resolveStepInput — 值类型', () => {
  it('支持字符串、数字、布尔、对象、null', () => {
    const map: WorkflowStepDataFlowMap = {
      str: { stepId: 's', outputKey: 'str' },
      num: { stepId: 's', outputKey: 'num' },
      bool: { stepId: 's', outputKey: 'bool' },
      obj: { stepId: 's', outputKey: 'obj' },
      nil: { stepId: 's', outputKey: 'nil' },
    };
    const outputs: ExecutedStepOutputs = {
      s: { str: 'text', num: 42, bool: false, obj: { a: 1 }, nil: null },
    };
    const r = resolveStepInput(map, outputs);
    expect(r.resolved.str).toBe('text');
    expect(r.resolved.num).toBe(42);
    expect(r.resolved.bool).toBe(false);
    expect(r.resolved.obj).toEqual({ a: 1 });
    expect(r.resolved.nil).toBeNull();
    expect(r.unresolved).toHaveLength(0);
  });
});

describe('mergeStepInputs', () => {
  it('动态值覆盖静态变量', () => {
    const static_ = { title: 'static-title', extra: 'keep' };
    const dynamic = { title: 'dynamic-title', score: 99 };
    const result = mergeStepInputs(static_, dynamic);
    expect(result.title).toBe('dynamic-title');
    expect(result.extra).toBe('keep');
    expect(result.score).toBe(99);
  });

  it('无动态值 → 返回静态变量', () => {
    const result = mergeStepInputs({ a: '1', b: '2' }, {});
    expect(result).toEqual({ a: '1', b: '2' });
  });

  it('无静态变量 → 返回动态值', () => {
    const result = mergeStepInputs({}, { x: 123 });
    expect(result).toEqual({ x: 123 });
  });

  it('不可变：不修改 staticVars 对象', () => {
    const static_ = { a: 'original' };
    mergeStepInputs(static_, { a: 'override' });
    expect(static_.a).toBe('original');
  });
});
