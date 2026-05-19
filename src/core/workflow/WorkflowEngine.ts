/**
 * 工作流执行引擎
 * 
 * 实现 E4（随时保持回退）原则：
 * - 所有操作生成撤销令牌
 * - 失败时自动降级
 * - 提供操作历史栈
 */

import { SystemMeta } from '../system/types';
import { Skill, SkillInput, SkillOutput } from '../skills/types';
import { IRefundService } from '../skills/payment/types';
import { appendWorkflowFailureLog } from '../observability/workflowFailureLog';
import {
  workflowFailureLogParamsFromContext,
  type WorkflowCompensationHook,
  type WorkflowFailureCompensationContext,
} from './workflowCompensation';
import { Workflow, WorkflowStep, WorkflowStatus, Deliverable } from './types';
import { resolveStepInput, mergeStepInputs, type ExecutedStepOutputs } from './stepDataFlow';
import { buildDagOrder } from './dagSort';

function cloneWorkflowStatus(s: WorkflowStatus): WorkflowStatus {
  const copy: WorkflowStatus = {
    currentStep: s.currentStep,
    totalSteps: s.totalSteps,
    stepName: s.stepName,
    isComplete: s.isComplete,
  };
  if (s.error !== undefined) {
    copy.error = s.error;
  }
  if (s.stackClearedAfterFailure !== undefined) {
    copy.stackClearedAfterFailure = s.stackClearedAfterFailure;
  }
  return copy;
}

/** Sprint E：execute() 可选配置项 */
export interface WorkflowExecuteOptions {
  /**
   * true：dataFlowMap 中有未解析绑定时抛错（绑定来源步骤未执行或字段不存在）。
   * false/未提供（默认）：静默跳过，退化为静态 inputTemplate 值。
   */
  strictDataFlow?: boolean;
}

/**
 * 工作流引擎接口
 */
export interface IWorkflowEngine {
  /**
   * 执行完整工作流
   * @param intent 用户意图
   * @param workflow 工作流定义
   * @param meta 系统元信息
   * @param options 可选执行配置
   * @returns 最终可交付方案（如 PDF Blob）
   */
  execute(
    intent: string,
    workflow: Workflow,
    meta: SystemMeta,
    options?: WorkflowExecuteOptions
  ): Promise<Deliverable>;

  /**
   * 获取当前执行状态（用于 UI 进度条）
   */
  getStatus(): WorkflowStatus;

  /**
   * 撤销上一步操作（E4 要求）
   */
  undo(): Promise<boolean>;

  /**
   * 注册工作流失败时的补偿钩子（在内置支付退款之前按注册顺序执行；单步内勿抛错以免干扰其它钩子）
   */
  registerCompensationHook(hook: WorkflowCompensationHook): void;
}

/**
 * 操作日志（用于撤销功能）
 */
interface OperationLog {
  id: string;
  action: 'execute-step' | 'fallback' | 'complete';
  timestamp: number;
  stepId?: string;
  /** E4：撤销前的工作流 UI 状态快照（深拷贝自 `WorkflowStatus`） */
  undoData?: { status: WorkflowStatus };
  canUndo: boolean;
}

/**
 * 工作流引擎实现
 */
export class WorkflowEngine implements IWorkflowEngine {
  private status: WorkflowStatus = {
    currentStep: 0,
    totalSteps: 0,
    stepName: '',
    isComplete: false,
    stackClearedAfterFailure: false,
  };

  private operationStack: OperationLog[] = [];
  private maxStackSize = 10; // E4：最多保留 10 步操作历史

  private skills: Map<string, Skill> = new Map();
  private refundService?: IRefundService; // E4：支付退款服务（可选）
  private compensationHooks: WorkflowCompensationHook[] = [];

  /**
   * 注册 Skill
   */
  registerSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }

  /**
   * 设置退款服务（E4：支付回退）
   */
  setRefundService(service: IRefundService): void {
    this.refundService = service;
  }

  registerCompensationHook(hook: WorkflowCompensationHook): void {
    this.compensationHooks.push(hook);
  }

  /**
   * 执行工作流
   */
  async execute(
    intent: string,
    workflow: Workflow,
    meta: SystemMeta,
    options?: WorkflowExecuteOptions
  ): Promise<Deliverable> {
    this.operationStack = [];

    // Sprint E：按 dependsOn 拓扑排序，无 dependsOn 保持原顺序
    const orderedSteps = buildDagOrder(workflow.steps);

    // 初始化状态
    this.status = {
      currentStep: 0,
      totalSteps: orderedSteps.length,
      stepName: workflow.metadata.name,
      isComplete: false,
      stackClearedAfterFailure: false,
    };

    const stepOutputs: SkillOutput[] = [];
    // Sprint D：按 stepId 索引已完成步骤输出，供下游 dataFlowMap 解析
    const executedOutputs: ExecutedStepOutputs = {};

    try {
      // 执行每个步骤（拓扑排序后的顺序）
      for (let i = 0; i < orderedSteps.length; i++) {
        const step = orderedSteps[i];
        const statusBeforeStep = cloneWorkflowStatus(this.status);
        this.status.currentStep = i;
        this.status.stepName = step.id;

        // 记录操作日志（含 E4 可恢复快照）
        this.pushOperation({
          id: `step-${i}-${Date.now()}`,
          action: 'execute-step',
          timestamp: Date.now(),
          stepId: step.id,
          canUndo: true,
          undoData: { status: statusBeforeStep },
        });

        // 执行步骤
        const output = await this.executeStep(step, intent, meta, executedOutputs, options?.strictDataFlow);
        stepOutputs.push(output);
        // 记录输出供后续步骤绑定（content + format + metadata 字段全部展开）
        executedOutputs[step.id] = {
          content: output.content,
          format: output.format,
          ...output.metadata,
        };
      }

      // 完成
      this.status.isComplete = true;
      this.status.stackClearedAfterFailure = false;

      // 生成可交付成果
      const deliverable = await this.generateDeliverable(
        workflow,
        stepOutputs,
        meta
      );

      return deliverable;
    } catch (error) {
      this.status.error = error instanceof Error ? error.message : '未知错误';
      this.status.stackClearedAfterFailure = true;

      const failureCtx: WorkflowFailureCompensationContext = {
        workflowId: workflow.id,
        scenarioId: workflow.scenarioId,
        failedStepIndex: this.status.currentStep,
        failedStepId: this.status.stepName,
        totalSteps: orderedSteps.length,
        completedStepOutputs: stepOutputs.length,
        errorMessage: this.status.error,
        stepOutputs,
        steps: orderedSteps,
      };

      appendWorkflowFailureLog(workflowFailureLogParamsFromContext(failureCtx));

      // E4：失败路径清空步骤栈，避免误撤销到与抛错时状态不一致的快照
      this.operationStack = [];

      await this.runFailureCompensation(failureCtx);

      throw error;
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: WorkflowStep,
    intent: string,
    meta: SystemMeta,
    executedOutputs: ExecutedStepOutputs = {},
    strictDataFlow = false
  ): Promise<SkillOutput> {
    const skill = this.skills.get(step.skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${step.skillId}`);
    }

    // E4：检查是否需要网络（Stage 0 禁止）
    if (skill.metadata.requiresNetwork && !meta.capabilities.thirdPartyAPI) {
      return await this.handleFallback(step, intent, meta);
    }

    // Sprint D/E：输入解析在 try/catch 外执行，使 strictDataFlow 错误直接上抛而不触发 fallback
    const staticVars = this.resolveTemplate(step.inputTemplate, { intent });
    let dynamicVars: Record<string, unknown> = {};
    if (step.dataFlowMap && Object.keys(step.dataFlowMap).length > 0) {
      const { resolved, unresolved } = resolveStepInput(step.dataFlowMap, executedOutputs);
      // Sprint E strictDataFlow：未解析绑定在严格模式下直接抛错（不走 fallback）
      if (strictDataFlow && unresolved.length > 0) {
        throw new Error(
          `WorkflowEngine [strictDataFlow]: 步骤 "${step.id}" 存在未解析的 dataFlow 绑定：${unresolved.join(', ')}`
        );
      }
      dynamicVars = resolved;
    }

    const input: SkillInput = {
      prompt: intent,
      ...mergeStepInputs(staticVars, dynamicVars),
    };

    try {
      return await skill.execute(input, meta);
    } catch (error) {
      return await this.handleFallback(step, intent, meta);
    }
  }

  /**
   * 处理降级策略（E4 要求）
   */
  private async handleFallback(
    step: WorkflowStep,
    intent: string,
    meta: SystemMeta
  ): Promise<SkillOutput> {
    if (!step.fallback) {
      throw new Error(`Step ${step.id} failed and no fallback strategy`);
    }

    // 记录降级操作
    this.pushOperation({
      id: `fallback-${step.id}-${Date.now()}`,
      action: 'fallback',
      timestamp: Date.now(),
      stepId: step.id,
      canUndo: false,
    });

    const strategy = step.fallback;

    switch (strategy.type) {
      case 'skip':
        // 跳过此步骤，返回可读的降级提示，避免前端出现“空白方案”错觉
        return {
          content: `## 生成降级提示\n\n当前步骤「${step.id}」未能正常完成，系统已触发降级策略（skip）以保证流程不中断。\n\n你可以：\n- 补充更具体的关键词后重新生成；\n- 切换到模板参数路径后再生成；\n- 保留当前结果并继续编辑关键词。`,
          format: 'text/plain',
          metadata: {
            skillId: step.skillId,
            timestamp: Date.now(),
            confidence: 0,
            fallbackApplied: true,
            fallbackType: 'skip',
            fallbackStepId: step.id,
          },
        };

      case 'use-cache':
        // 使用缓存（Stage 0 暂不支持）
        throw new Error('Cache fallback not implemented in Stage 0');

      case 'simplified': {
        // 使用简化方案
        const simplifiedSkill = this.skills.get(strategy.alternativeSkillId);
        if (!simplifiedSkill) {
          throw new Error(`Simplified skill not found: ${strategy.alternativeSkillId}`);
        }
        return await simplifiedSkill.execute({ prompt: intent }, meta);
      }

      default: {
        const t = strategy as { type?: string };
        throw new Error(`Unknown fallback strategy: ${t.type ?? 'unknown'}`);
      }
    }
  }

  /**
   * 解析模板变量
   */
  private resolveTemplate(
    template: Record<string, string>,
    context: Record<string, string>
  ): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(template)) {
      // 简单的模板变量替换：{{variable}} -> context.variable
      resolved[key] = value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
        return context[varName] || '';
      });
    }
    return resolved;
  }

  /**
   * 生成可交付成果
   */
  private async generateDeliverable(
    workflow: Workflow,
    stepOutputs: SkillOutput[],
    _meta: SystemMeta
  ): Promise<Deliverable> {
    const mergedSkillMetadata = stepOutputs.reduce<Record<string, unknown>>((acc, output) => {
      if (output && output.metadata && typeof output.metadata === 'object') {
        Object.assign(acc, output.metadata);
      }
      return acc;
    }, {});

    // 合并所有步骤的输出
    const combinedContent = stepOutputs
      .map((output) => {
        if (typeof output.content === 'string') {
          return output.content;
        }
        return JSON.stringify(output.content);
      })
      .join('\n\n');

    // 根据输出格式生成最终内容
    let content: Blob | string;
    let format: string;

    switch (workflow.metadata.outputFormat) {
      case 'pdf':
        // TODO: 使用 jsPDF 生成 PDF
        content = new Blob([combinedContent], { type: 'text/plain' });
        format = 'application/pdf';
        break;
      case 'html':
        // Stage 0: 直接返回 Markdown 文本，由前端组件渲染
        content = combinedContent;
        format = 'text/markdown';
        break;
      case 'markdown':
        content = combinedContent;
        format = 'text/markdown';
        break;
      case 'json':
        content = JSON.stringify(stepOutputs, null, 2);
        format = 'application/json';
        break;
      default:
        content = combinedContent;
        format = 'text/plain';
    }

    // E4：生成撤销令牌
    const undoToken = this.generateUndoToken();

    return {
      content,
      format,
      metadata: {
        ...mergedSkillMetadata,
        workflowId: workflow.id,
        scenarioId: workflow.scenarioId,
        timestamp: Date.now(),
        undoToken,
      },
    };
  }

  /**
   * 生成撤销令牌
   */
  private generateUndoToken(): string {
    return `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 记录操作到历史栈
   */
  private pushOperation(log: OperationLog): void {
    this.operationStack.push(log);
    if (this.operationStack.length > this.maxStackSize) {
      this.operationStack.shift(); // 移除最旧的操作
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): WorkflowStatus {
    return { ...this.status };
  }

  /**
   * 撤销最近一条可撤销的步骤（E4：从栈顶丢弃 `canUndo:false` 的占位后恢复状态快照）
   */
  async undo(): Promise<boolean> {
    while (this.operationStack.length > 0) {
      const last = this.operationStack[this.operationStack.length - 1];
      if (!last.canUndo) {
        this.operationStack.pop();
        continue;
      }
      const snap = last.undoData?.status;
      if (snap) {
        this.operationStack.pop();
        this.status = cloneWorkflowStatus(snap);
        return true;
      }
      this.operationStack.pop();
    }
    return false;
  }

  /**
   * 可扩展补偿：先执行注册的钩子，再执行内置支付退款（与 `workflowFailureLog` 同源上下文）
   */
  private async runFailureCompensation(ctx: WorkflowFailureCompensationContext): Promise<void> {
    for (const hook of this.compensationHooks) {
      try {
        await hook(ctx);
      } catch (e) {
        console.error('[WorkflowEngine] compensation hook failed:', e);
      }
    }
    await this.refundPaymentStepIfNeeded(ctx);
  }

  /**
   * E4：失败路径自动回退已成功的支付步骤（内置，非业务全量反写）
   */
  private async refundPaymentStepIfNeeded(ctx: WorkflowFailureCompensationContext): Promise<void> {
    if (!this.refundService) {
      return;
    }

    const paymentOutput = ctx.stepOutputs.find((output) => output.format === 'payment');

    if (paymentOutput && paymentOutput.content) {
      const content = paymentOutput.content as { undoToken?: string };
      if (content.undoToken) {
        try {
          await this.refundService.undo(content.undoToken);
          console.log(`[WorkflowEngine] Auto-refunded payment: ${content.undoToken}`);
        } catch (error) {
          console.error(`[WorkflowEngine] Auto-refund failed:`, error);
        }
      }
    }
  }
}
