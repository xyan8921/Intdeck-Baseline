/**
 * Intdone 意图执行引擎
 * 
 * 这是 Intdone 的核心执行引擎，由 Skill（能力单元）与 Workflow（编排计划）构成。
 * 
 * 设计理念：
 * - Skill = 执行算子（Operator）
 * - Workflow = 执行计划（Execution Plan）
 * - PresetLoader + WorkflowEngine = 查询优化器 + 执行器
 * 
 * 这是面向未来的、伦理内嵌的智能执行引擎，不是传统规则引擎或模板引擎。
 * 
 * @see [智能执行系统规范](../../../Intdone%20智能执行系统规范.md)
 * @see [伦理宪章](../../../ETHICS.md)
 */

import { SystemMeta } from '../system/types';
import { WorkflowEngine } from '../workflow/WorkflowEngine';
import { Workflow, Deliverable, WorkflowStatus } from '../workflow/types';
import { Skill } from '../skills/types';
import { presetLoader } from '../ontology/PresetLoader';
import { workflowLoader } from '../ontology/WorkflowLoader';
import { renderTemplate } from '../../shared/utils/templateParser';
import type { Scenario } from '../ontology/types';
import type { IntentTopLevelCategory } from '../storage/types';
import { buildGenericPlanningPrompt } from '../execution/buildGenericPrompt';
import { shapeDeliverable } from '../plan/PlanShaper';
import { appendExecutionLog } from '../observability/executionLog';
import { isE4UndoTokenWellFormed } from '../ethics/e4RevocabilityEthics';

/**
 * 执行上下文
 */
export interface ExecutionContext {
  /** 用户类型 */
  userType?: 'B' | 'C';
  /** 用户声明的上下文（personal/work） */
  userDeclaredContext?: 'personal' | 'work';
  /** 其他运行时参数 */
  [key: string]: unknown;
}

/**
 * 意图执行引擎接口
 * 
 * 这是 Intdone 的核心引擎接口，提供标准化的意图执行能力。
 */
export interface IIntentExecutionEngine {
  /**
   * 执行用户意图（自然语言）
   * @param intent 用户自然语言意图
   * @param context 执行上下文
   * @returns 可交付成果
   */
  execute(intent: string, context?: ExecutionContext): Promise<Deliverable>;

  /**
   * 获取当前执行状态（用于进度条）
   */
  getStatus(): WorkflowStatus;

  /**
   * 撤销上一次执行（E4：随时保持回退）
   * @param token 撤销令牌（从 Deliverable.metadata.undoToken 获取）
   */
  undo(token: string): Promise<boolean>;
}

/**
 * 意图执行引擎实现
 * 
 * 这是 WorkflowEngine 的高级包装，提供更符合"引擎"语义的接口。
 * 内部仍使用 WorkflowEngine 执行，保持零冗余。
 */
export class IntentExecutionEngine implements IIntentExecutionEngine {
  private workflowEngine: WorkflowEngine;
  private currentWorkflow: Workflow | null = null;
  private currentMeta: SystemMeta;
  /** 最近一次成功执行摘要，供 E4 undo 写执行日志 */
  private lastExecutionSummary: {
    templateId: string;
    workflowId: string;
    executionPath: 'template' | 'keyword-generic';
    skillIds: string[];
  } | null = null;
  /**
   * 与当前工作流栈绑定的撤销令牌（最近一次成功跑完工作流并产出 Deliverable 后写入）。
   * 新一次 `execute` 开始前会清空，避免用旧 token 误撤销新运行。
   */
  private lastDeliverableUndoToken: string | null = null;

  constructor(meta: SystemMeta) {
    this.workflowEngine = new WorkflowEngine();
    this.currentMeta = meta;
  }

  /**
   * 注册 Skill
   */
  registerSkill(skill: Skill): void {
    this.workflowEngine.registerSkill(skill);
  }

  /**
   * 执行用户意图
   * 
   * 方式一：传入 Workflow 和上下文
   * ```ts
   * await engine.execute(intent, workflow, { userType: 'C' });
   * ```
   * 
   * 方式二：预先设置 Workflow，仅传入意图和上下文
   * ```ts
   * engine.setWorkflow(workflow);
   * await engine.execute(intent, { userType: 'C' });
   * ```
   * 
   * 注意：完整流程通常是：意图 → IntentRouter → Scenario → Workflow → execute()
   */
  async execute(
    intent: string,
    workflowOrContext?: Workflow | ExecutionContext,
    context?: ExecutionContext
  ): Promise<Deliverable> {
    let workflow: Workflow;
    let execContext: ExecutionContext | undefined;

    // 判断参数类型
    if (workflowOrContext && 'id' in workflowOrContext && 'steps' in workflowOrContext) {
      // 第二个参数是 Workflow
      workflow = workflowOrContext as Workflow;
      execContext = context;
    } else if (workflowOrContext && ('userType' in workflowOrContext || 'userDeclaredContext' in workflowOrContext)) {
      // 第二个参数是 ExecutionContext
      if (!this.currentWorkflow) {
        throw new Error('Workflow not set. Call setWorkflow() first or pass workflow as second parameter.');
      }
      workflow = this.currentWorkflow;
      execContext = workflowOrContext;
    } else {
      // 只有 intent，使用预设的 workflow
      if (!this.currentWorkflow) {
        throw new Error('Workflow not set. Call setWorkflow() first or pass workflow as second parameter.');
      }
      workflow = this.currentWorkflow;
      execContext = undefined;
    }

    // 更新执行上下文到 SystemMeta
    if (execContext) {
      this.updateContext(execContext);
    }

    this.beginE4Run();
    const deliverable = await this.workflowEngine.execute(intent, workflow, this.currentMeta);
    this.lastExecutionSummary = {
      templateId: workflow.scenarioId,
      workflowId: workflow.id,
      executionPath: 'template',
      skillIds: workflow.steps.map((s) => s.skillId),
    };
    this.captureDeliverableUndoToken(deliverable);
    return deliverable;
  }

  /**
   * 设置当前工作流
   */
  setWorkflow(workflow: Workflow): void {
    this.currentWorkflow = workflow;
  }

  /**
   * 更新执行上下文
   */
  private updateContext(context: ExecutionContext): void {
    if (context.userType) {
      this.currentMeta.context.userType = context.userType;
    }
    // 未来可扩展 userDeclaredContext
    // if (context.userDeclaredContext) {
    //   this.currentMeta.context.userDeclaredContext = context.userDeclaredContext;
    // }
  }

  /**
   * 获取当前执行状态
   */
  getStatus(): WorkflowStatus {
    return this.workflowEngine.getStatus();
  }

  /**
   * 撤销上一次执行
   */
  async undo(token: string): Promise<boolean> {
    if (!isE4UndoTokenWellFormed(token)) {
      return false;
    }
    if (!this.lastDeliverableUndoToken || token !== this.lastDeliverableUndoToken) {
      return false;
    }
    const ok = await this.workflowEngine.undo();
    if (ok) {
      const s = this.lastExecutionSummary;
      appendExecutionLog({
        action: 'undo',
        undoToken: token,
        executionPath: s?.executionPath ?? 'template',
        templateId: s?.templateId ?? 'unknown',
        workflowId: s?.workflowId ?? 'unknown',
        skillIds: s?.skillIds ?? [],
      });
    }
    return ok;
  }

  /**
   * 获取底层 WorkflowEngine（用于高级操作）
   */
  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine;
  }

  /** 新工作流运行开始前清空 E4 令牌绑定（失败路径不恢复旧 token） */
  private beginE4Run(): void {
    this.lastDeliverableUndoToken = null;
  }

  private captureDeliverableUndoToken(d: Deliverable): void {
    const t = d.metadata?.undoToken;
    if (typeof t === 'string' && isE4UndoTokenWellFormed(t)) {
      this.lastDeliverableUndoToken = t;
    } else {
      this.lastDeliverableUndoToken = null;
    }
  }

  /**
   * 从模板执行（Stage 0 模板驱动执行）
   * 
   * @param templateId 模板 ID（如 "dinosaur-party"）
   * @param userParams 用户输入的参数（如 { age: 5, theme: "恐龙" }）
   * @param context 执行上下文
   */
  async executeFromTemplate(
    templateId: string,
    userParams: Record<string, unknown>,
    context?: ExecutionContext
  ): Promise<Deliverable> {
    // 1. 加载模板
    const template = await presetLoader.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 2. 加载 Workflow
    const workflow = await workflowLoader.load(template.workflowId);

    // 3. 渲染 promptTemplate
    const resolvedPrompt = renderTemplate(template.promptTemplate, userParams);

    // 4. 更新 SystemMeta（注入模板信息）
    const metaWithTemplate = {
      ...this.currentMeta,
      context: {
        ...this.currentMeta.context,
        templateId: template.id,
        scenarioId: template.id,
      },
    };

    // 5. 更新执行上下文
    if (context) {
      this.updateContext(context);
    }

    // 6. 执行 Workflow（注入渲染后的 prompt）
    const intent = resolvedPrompt;
    const workflowWithPrompt = {
      ...workflow,
      steps: workflow.steps.map(step => ({
        ...step,
        inputTemplate: {
          ...step.inputTemplate,
          prompt: resolvedPrompt,
          scenarioId: template.id,
          templateId: template.id,
        },
      })),
    };

    this.beginE4Run();
    const rawDeliverable = await this.workflowEngine.execute(
      intent,
      workflowWithPrompt,
      metaWithTemplate
    );

    const shaped = shapeDeliverable(template, userParams, rawDeliverable);

    this.lastExecutionSummary = {
      executionPath: 'template',
      templateId: template.id,
      workflowId: template.workflowId,
      skillIds: [...template.skills],
    };
    this.captureDeliverableUndoToken(shaped);
    appendExecutionLog({
      action: 'execute',
      executionPath: 'template',
      templateId: template.id,
      workflowId: template.workflowId,
      skillIds: [...template.skills],
    });

    return shaped;
  }

  /**
   * 关键词驱动通用路径（Phase 2.2.2）：不依赖 preset-templates.json 中的 Scenario 定义。
   */
  async executeFromKeywordBundle(
    input: {
      topLevelCategory: IntentTopLevelCategory;
      subCategoryId: string;
      entries: Record<string, string>;
      outputTier?: 'standard' | 'pro';
      seed?: string | number;
    },
    context?: ExecutionContext
  ): Promise<Deliverable> {
    const workflow = await workflowLoader.load('generic-keyword-workflow');
    const resolvedPrompt = buildGenericPlanningPrompt(input);

    const metaWithTemplate = {
      ...this.currentMeta,
      context: {
        ...this.currentMeta.context,
        templateId: 'generic-keyword',
        scenarioId: 'generic-keyword',
      },
    };

    if (context) {
      this.updateContext(context);
    }

    const workflowWithPrompt = {
      ...workflow,
      steps: workflow.steps.map((step) => ({
        ...step,
        inputTemplate: {
          ...step.inputTemplate,
          prompt: resolvedPrompt,
          scenarioId: 'generic-keyword',
          templateId: 'generic-keyword',
        },
      })),
    };

    this.beginE4Run();
    const rawDeliverable = await this.workflowEngine.execute(
      resolvedPrompt,
      workflowWithPrompt,
      metaWithTemplate
    );

    const params: Record<string, unknown> = { ...input.entries };
    if (input.entries.budget) {
      const n = Number(String(input.entries.budget).replace(/[^\d.]/g, ''));
      if (Number.isFinite(n)) params.budget = n;
    }

    const synthetic: Scenario = {
      id: 'generic-keyword',
      name: '关键词通用方案',
      category: 'C端',
      promptTemplate: resolvedPrompt,
      workflowId: 'generic-keyword-workflow',
      skills: ['text-generation', 'user-review'],
      ethicalPrinciples: ['E1', 'E3', 'E6'],
    };

    const shaped = shapeDeliverable(synthetic, params, rawDeliverable);

    this.lastExecutionSummary = {
      executionPath: 'keyword-generic',
      templateId: 'generic-keyword',
      workflowId: 'generic-keyword-workflow',
      skillIds: [...synthetic.skills],
    };
    this.captureDeliverableUndoToken(shaped);
    appendExecutionLog({
      action: 'execute',
      executionPath: 'keyword-generic',
      templateId: 'generic-keyword',
      workflowId: 'generic-keyword-workflow',
      skillIds: [...synthetic.skills],
    });

    return shaped;
  }
}

/**
 * 创建意图执行引擎
 * 
 * 便捷工厂函数，用于创建并配置引擎实例。
 */
export function createIntentExecutionEngine(
  meta: SystemMeta,
  skills?: Skill[]
): IntentExecutionEngine {
  const engine = new IntentExecutionEngine(meta);
  
  if (skills) {
    skills.forEach(skill => engine.registerSkill(skill));
  }
  
  return engine;
}
