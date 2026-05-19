/**
 * E4：工作流失败时的补偿上下文与可扩展钩子（与 `workflowFailureLog` 字段同源，避免分叉）
 */
import type { SkillOutput } from '../skills/types';
import type { WorkflowFailureLogEntry } from '../observability/workflowFailureLog';
import type { WorkflowStep } from './types';

/** 单次 `execute` 失败路径上传递给补偿逻辑的快照（含已成功步骤的输出） */
export interface WorkflowFailureCompensationContext {
  workflowId: string;
  scenarioId: string;
  failedStepIndex: number;
  failedStepId: string;
  totalSteps: number;
  /** 已成功并入 `stepOutputs` 的步骤数（失败步未计入），与 `WorkflowFailureLogEntry.completedStepOutputs` 一致 */
  completedStepOutputs: number;
  errorMessage: string;
  stepOutputs: readonly SkillOutput[];
  steps: readonly WorkflowStep[];
}

export type WorkflowCompensationHook = (
  ctx: WorkflowFailureCompensationContext
) => void | Promise<void>;

export function workflowFailureLogParamsFromContext(
  ctx: WorkflowFailureCompensationContext
): Omit<
  WorkflowFailureLogEntry,
  'id' | 'timestamp' | 'schemaVersion' | 'stackClearedAfterFailure'
> {
  return {
    workflowId: ctx.workflowId,
    scenarioId: ctx.scenarioId,
    failedStepIndex: ctx.failedStepIndex,
    failedStepId: ctx.failedStepId,
    totalSteps: ctx.totalSteps,
    completedStepOutputs: ctx.completedStepOutputs,
    errorMessage: ctx.errorMessage,
  };
}
