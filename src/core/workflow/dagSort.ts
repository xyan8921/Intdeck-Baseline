/**
 * DAG 拓扑排序（Sprint E）：
 * 根据 WorkflowStep.dependsOn 字段计算合法执行顺序。
 * 无 dependsOn 的步骤保持原数组相对顺序（向后兼容）。
 */

import type { WorkflowStep } from './types';

export class WorkflowCycleError extends Error {
  /** 参与循环的步骤 ID 列表（非完整环路，仅剩余未排序集合） */
  readonly cycleStepIds: string[];

  constructor(cycleStepIds: string[]) {
    super(
      `WorkflowEngine: DAG 循环依赖，无法确定执行顺序。涉及步骤：${cycleStepIds.join(', ')}`
    );
    this.name = 'WorkflowCycleError';
    this.cycleStepIds = cycleStepIds;
  }
}

/**
 * Kahn 算法拓扑排序：将 WorkflowStep[] 按 dependsOn 约束重排。
 *
 * - 无 dependsOn 的步骤在同批次中保持原数组顺序
 * - dependsOn 指向不存在步骤 → 抛 Error
 * - 循环依赖 → 抛 WorkflowCycleError
 */
export function buildDagOrder(steps: WorkflowStep[]): WorkflowStep[] {
  if (steps.length === 0) return [];

  const idToStep = new Map<string, WorkflowStep>(steps.map((s) => [s.id, s]));

  // 校验所有 dependsOn 引用合法
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!idToStep.has(dep)) {
        throw new Error(
          `WorkflowEngine: 步骤 "${step.id}" 依赖未知步骤 "${dep}"`
        );
      }
    }
  }

  // 计算入度
  const inDegree = new Map<string, number>(steps.map((s) => [s.id, 0]));
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      void dep; // dep → step：step 的入度 +1
    }
  }
  // 重新计算（依赖 step.id 的步骤入度 = 其 dependsOn 数量）
  for (const step of steps) {
    inDegree.set(step.id, (step.dependsOn ?? []).length);
  }

  // 初始队列：入度为 0 的步骤，按原数组顺序
  const queue: WorkflowStep[] = steps.filter((s) => inDegree.get(s.id) === 0);
  const sorted: WorkflowStep[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    // 将依赖 current 的步骤入度 -1，降为 0 时入队（保持原数组相对顺序）
    for (const step of steps) {
      if (step.dependsOn?.includes(current.id)) {
        const newDeg = (inDegree.get(step.id) ?? 0) - 1;
        inDegree.set(step.id, newDeg);
        if (newDeg === 0) {
          queue.push(step);
        }
      }
    }
  }

  if (sorted.length !== steps.length) {
    const cycleIds = steps
      .filter((s) => !sorted.some((ss) => ss.id === s.id))
      .map((s) => s.id);
    throw new WorkflowCycleError(cycleIds);
  }

  return sorted;
}
