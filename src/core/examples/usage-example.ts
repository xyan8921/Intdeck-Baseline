/**
 * Stage 0 使用示例
 * 
 * 演示如何使用 IntentExecutionEngine（意图执行引擎）构建完整的意图执行流程
 * 
 * 核心概念：
 * - IntentExecutionEngine = 意图执行引擎（核心接口）
 * - WorkflowEngine = 工作流执行器（底层实现）
 * - Skill = 执行算子（原子能力）
 * - Workflow = 执行计划（编排定义）
 */

import { createSystemMeta, SystemMeta } from '../system/types';
import { TextGenerationSkill } from '../skills/mock/TextGenerationSkill';
import { createIntentExecutionEngine } from '../engine/IntentExecutionEngine';
import { WorkflowEngine } from '../workflow/WorkflowEngine';
import { Workflow } from '../workflow/types';
import { Scenario } from '../ontology/types';

/**
 * 示例：创建 Stage 0 系统元信息
 */
export function createStage0Meta(): SystemMeta {
  return createSystemMeta({
    version: '0.1.0',
    stage: 'stage0',
    context: {
      userType: 'C',
      scenarioId: 'dinosaur-party',
    },
  });
}

/**
 * 示例：创建恐龙派对工作流
 */
export function createDinosaurPartyWorkflow(): Workflow {
  return {
    id: 'dinosaur-party-workflow',
    scenarioId: 'dinosaur-party',
    steps: [
      {
        id: 'generate-text',
        skillId: 'text-generation',
        inputTemplate: {
          prompt: '{{intent}}',
          scenario: 'dinosaur-party',
        },
        fallback: {
          type: 'simplified',
          alternativeSkillId: 'text-generation',
          description: '使用简化文本生成',
        },
      },
    ],
    metadata: {
      name: '恐龙派对方案生成',
      description: '为5-8岁孩子生成恐龙主题生日派对方案',
      outputFormat: 'json',
      ethicalPrinciples: ['E1', 'E3', 'E4', 'E5'],
    },
  };
}

/**
 * 示例：创建恐龙派对场景
 */
export function createDinosaurPartyScenario(): Scenario {
  return {
    id: 'dinosaur-party',
    name: '恐龙派对',
    category: 'C端',
    promptTemplate: '请为{{age}}岁孩子策划{{theme}}派对',
    workflowId: 'dinosaur-party-workflow',
    skills: ['text-generation'],
    ethicalPrinciples: ['E1', 'E3', 'E4', 'E5'],
  };
}

/**
 * 示例：使用 IntentExecutionEngine（推荐方式）
 */
export async function executeExampleWithEngine() {
  // 1. 创建系统元信息
  const meta = createStage0Meta();

  // 2. 创建意图执行引擎
  const textSkill = new TextGenerationSkill();
  const engine = createIntentExecutionEngine(meta, [textSkill]);

  // 3. 创建工作流
  const workflow = createDinosaurPartyWorkflow();
  engine.setWorkflow(workflow);

  // 4. 执行用户意图
  const intent = '为5岁孩子策划恐龙主题生日派对';
  
  try {
    const deliverable = await engine.execute(intent, {
      userType: 'C',
      userDeclaredContext: 'personal',
    });
    
    console.log('执行成功！');
    console.log('格式:', deliverable.format);
    console.log('撤销令牌:', deliverable.metadata.undoToken);
    
    // 获取执行状态
    const status = engine.getStatus();
    console.log('状态:', status);
    
    // 撤销操作（E4）
    const undone = await engine.undo(deliverable.metadata.undoToken);
    console.log('撤销结果:', undone);
    
    return deliverable;
  } catch (error) {
    console.error('执行失败:', error);
    throw error;
  }
}

/**
 * 示例：使用 WorkflowEngine（底层方式，高级用法）
 */
export async function executeExampleWithWorkflowEngine() {
  // 1. 创建系统元信息
  const meta = createStage0Meta();

  // 2. 创建工作流引擎（底层执行器）
  const engine = new WorkflowEngine();

  // 3. 注册 Skill
  const textSkill = new TextGenerationSkill();
  engine.registerSkill(textSkill);

  // 4. 创建工作流
  const workflow = createDinosaurPartyWorkflow();

  // 5. 执行工作流
  const intent = '为5岁孩子策划恐龙主题生日派对';
  
  try {
    const deliverable = await engine.execute(intent, workflow, meta);
    
    console.log('执行成功！');
    console.log('格式:', deliverable.format);
    console.log('撤销令牌:', deliverable.metadata.undoToken);
    
    // 获取执行状态
    const status = engine.getStatus();
    console.log('状态:', status);
    
    return deliverable;
  } catch (error) {
    console.error('执行失败:', error);
    throw error;
  }
}

/**
 * 示例：处理降级场景
 */
export async function executeWithFallback() {
  const meta = createStage0Meta();
  const engine = new WorkflowEngine();
  
  // 注册 Skill
  const textSkill = new TextGenerationSkill();
  engine.registerSkill(textSkill);
  
  // 创建带降级策略的工作流
  const workflow: Workflow = {
    id: 'test-workflow',
    scenarioId: 'test-scenario',
    steps: [
      {
        id: 'step-1',
        skillId: 'text-generation',
        inputTemplate: { prompt: '{{intent}}' },
        fallback: {
          type: 'skip',
          description: '如果失败则跳过此步骤',
        },
      },
    ],
    metadata: {
      name: '测试工作流',
      description: '测试降级策略',
      outputFormat: 'json',
      ethicalPrinciples: ['E4'],
    },
  };
  
  // 执行（即使失败也会触发降级）
  const deliverable = await engine.execute('测试意图', workflow, meta);
  return deliverable;
}
