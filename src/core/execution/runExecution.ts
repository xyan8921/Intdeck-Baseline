/**
 * 统一执行入口（facade）：模板路径与关键词通用路径分流（Phase 2.2.2）
 */
import type { IntentExecutionEngine } from '../engine/IntentExecutionEngine';
import type { ExecutionContext } from '../engine/IntentExecutionEngine';
import type { Deliverable } from '../workflow/types';
import type { ExecutionRequest } from './types';

export async function runExecution(
  engine: IntentExecutionEngine,
  request: ExecutionRequest,
  context?: ExecutionContext
): Promise<Deliverable> {
  if (request.path === 'template') {
    return engine.executeFromTemplate(request.templateId, request.params, context);
  }
  return engine.executeFromKeywordBundle(
    {
      topLevelCategory: request.topLevelCategory,
      subCategoryId: request.subCategoryId,
      entries: request.entries,
      outputTier: request.outputTier,
      seed: request.seed,
    },
    context
  );
}
