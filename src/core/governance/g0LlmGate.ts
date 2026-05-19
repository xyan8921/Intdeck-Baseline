import type { SystemMeta } from '../system/types';
import { runG0Action } from './g0Shell';
import type { G0ActorContext, G0CorrelationKeys, G0PurposeScope } from './g0Types';
import { selectLlmRoute } from './llmRouter';
import type { LlmProvider, LlmRoutingProfile, LlmRouteDecision } from './llmRouter';

export type { LlmProvider, LlmRoutingProfile, LlmRouteDecision };

export interface G0LlmCallContext {
  provider: LlmProvider;
  model: string;
  /**
   * 预算/成本信息（v1.0 先占位，后续与 FinOps 打通）
   */
  budget?: Record<string, unknown>;
}

/**
 * G0 Pre-LLM Gate（Sprint C Stage 1）：
 *   - capabilities.llm=false → G0_BLOCK（fail-closed）
 *   - capabilities.llm=true → LlmRouter 选路 → fn 执行
 *
 * fn 自行负责实际 HTTP 调用；Router 只提供路由决策（写入 G0 inputSnapshot）。
 */
export async function runG0LlmCall<T>(input: {
  meta: SystemMeta;
  llm: G0LlmCallContext;
  actor: G0ActorContext;
  purposeScope: G0PurposeScope;
  correlation?: G0CorrelationKeys;
  promptSnapshot?: unknown;
  /** Sprint C：覆盖路由表（测试或自定义部署） */
  routingTable?: LlmRoutingProfile[];
  fn: () => Promise<T>;
}): Promise<T> {
  // 路由决策在进入 G0 壳前计算，写入 inputSnapshot 可审计
  const routeDecision: LlmRouteDecision | null = selectLlmRoute({
    capabilities: {
      llm: input.meta.capabilities.llm,
      thirdPartyAPI: input.meta.capabilities.thirdPartyAPI,
    },
    routingTable: input.routingTable,
    preferredProvider: input.llm.provider !== 'other' ? input.llm.provider : undefined,
  });

  const res = await runG0Action({
    module: 'governance',
    action: `llm:${routeDecision?.provider ?? 'blocked'}:${routeDecision?.model ?? 'none'}`,
    actor: input.actor,
    purposeScope: input.purposeScope,
    correlation: input.correlation,
    inputSnapshot: {
      llm: input.llm,
      prompt: input.promptSnapshot,
      stage: input.meta.stage,
      routeDecision,
    },
    fn: async () => {
      if (!routeDecision) {
        throw new Error('G0_BLOCK: meta.capabilities.llm=false，LLM 路由不可用');
      }
      return input.fn();
    },
  });

  if (!res.ok) {
    throw new Error(res.report.summary.result.errorMessage || 'G0 llm call failed');
  }
  return res.output as T;
}
