/**
 * Workflow 加载器
 * 
 * 从 public/workflows/ 加载 Workflow 定义
 * 
 * @see [智能执行系统规范](../../../docs/Intdone%20智能执行系统规范.md)
 */

import { Workflow } from '../workflow/types';

/**
 * Workflow 加载器
 */
export class WorkflowLoader {
  private workflows: Map<string, Workflow> = new Map();
  private loadPromises: Map<string, Promise<Workflow>> = new Map();

  /**
   * 加载 Workflow
   */
  async load(workflowId: string): Promise<Workflow> {
    if (this.workflows.has(workflowId)) {
      return this.workflows.get(workflowId)!;
    }

    if (this.loadPromises.has(workflowId)) {
      return this.loadPromises.get(workflowId)!;
    }

    const promise = this._loadFromFile(workflowId);
    this.loadPromises.set(workflowId, promise);
    
    const workflow = await promise;
    this.workflows.set(workflowId, workflow);
    return workflow;
  }

  /**
   * 从文件加载 Workflow
   */
  private async _loadFromFile(workflowId: string): Promise<Workflow> {
    try {
      const response = await fetch(`/workflows/${workflowId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load workflow ${workflowId}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // 验证必需字段
      if (!data.id || !data.steps || !data.metadata) {
        throw new Error(`Invalid workflow format: ${workflowId}`);
      }

      // 转换 steps 对象为数组（如果使用对象格式）
      let steps = data.steps;
      if (!Array.isArray(steps) && typeof steps === 'object') {
        steps = Object.entries(steps as Record<string, unknown>).map(([id, step]) => ({
          id,
          ...(typeof step === 'object' && step !== null ? step : {}),
        }));
      }

      return {
        id: data.id,
        scenarioId: data.scenarioId || workflowId.replace('-workflow', ''),
        steps: steps,
        metadata: {
          name: data.metadata?.name || workflowId,
          description: data.metadata?.description || '',
          outputFormat: data.metadata?.outputFormat || 'html',
          ethicalPrinciples: data.metadata?.ethicalPrinciples || [],
        },
      } as Workflow;
    } catch (error) {
      console.error(`Failed to load workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.workflows.clear();
    this.loadPromises.clear();
  }
}

/**
 * 全局单例
 */
export const workflowLoader = new WorkflowLoader();
