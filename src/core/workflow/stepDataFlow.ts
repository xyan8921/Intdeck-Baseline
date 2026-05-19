/**
 * WorkflowStepDataFlow（Sprint C）：
 * 为 WorkflowEngine DAG 步骤间提供类型化输入/输出绑定层。
 * 本文件只涉及类型定义与 resolveStepInput 纯函数；
 * WorkflowEngine 执行逻辑的改造留 Sprint D。
 */

/** 指向某个已执行步骤输出中的具名字段 */
export interface StepOutputBinding {
  /** 输出来源步骤 ID */
  stepId: string;
  /** 步骤输出对象中的字段名 */
  outputKey: string;
}

/**
 * 某个步骤的数据流映射表：
 *   inputParamName → 从哪个步骤的哪个输出字段取值
 *
 * 与 WorkflowStep.inputTemplate 并列使用：
 *   - inputTemplate 覆盖静态字符串替换（Stage 0 现有逻辑）
 *   - dataFlowMap 覆盖跨步骤动态绑定（Stage 1+ DAG）
 */
export type WorkflowStepDataFlowMap = Record<string, StepOutputBinding>;

/**
 * 已执行步骤的输出汇总：
 *   stepId → 步骤输出对象（任意结构；类型由 Skill 合约保证）
 */
export type ExecutedStepOutputs = Record<string, Record<string, unknown>>;

export interface ResolvedStepInput {
  /** 成功解析的 paramName → value 映射 */
  resolved: Record<string, unknown>;
  /**
   * 未能解析的 paramName 列表（来源步骤未执行 / 字段不存在）。
   * 调用方决定是否视为错误（严格模式）或跳过（宽松模式）。
   */
  unresolved: string[];
}

/**
 * 根据数据流映射与已执行步骤输出，解析目标步骤的入参。
 *
 * 纯函数：无副作用，无 I/O。
 */
export function resolveStepInput(
  dataFlowMap: WorkflowStepDataFlowMap,
  executedOutputs: ExecutedStepOutputs
): ResolvedStepInput {
  const resolved: Record<string, unknown> = {};
  const unresolved: string[] = [];

  for (const [paramName, binding] of Object.entries(dataFlowMap)) {
    const stepOutput = executedOutputs[binding.stepId];
    if (stepOutput === undefined) {
      unresolved.push(paramName);
      continue;
    }
    if (!(binding.outputKey in stepOutput)) {
      unresolved.push(paramName);
      continue;
    }
    resolved[paramName] = stepOutput[binding.outputKey];
  }

  return { resolved, unresolved };
}

/**
 * 合并 dataFlowMap 解析结果与 inputTemplate 静态变量，返回最终输入对象。
 * dataFlowMap 解析值优先级高于 staticVars（跨步骤绑定覆盖静态模板）。
 */
export function mergeStepInputs(
  staticVars: Record<string, string>,
  dynamicResolved: Record<string, unknown>
): Record<string, unknown> {
  return { ...staticVars, ...dynamicResolved };
}
