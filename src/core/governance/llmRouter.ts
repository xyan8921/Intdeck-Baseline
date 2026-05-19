/**
 * LlmRouter Stage 1（Sprint C）：
 * 根据 manifest capabilities 选择模型/提供商。
 * 无 HTTP 调用 — 仅返回路由决策，fn 自行负责实际调用。
 */

export type LlmProvider = 'mock' | 'openai' | 'azure-openai' | 'anthropic' | 'other';

export interface LlmRouteDecision {
  model: string;
  provider: LlmProvider;
  /** 可读审计理由（写入 G0 inputSnapshot） */
  rationale: string;
}

export interface LlmRoutingProfile {
  provider: LlmProvider;
  model: string;
  /** true：要求 capabilities.thirdPartyAPI=true 才可选 */
  requiresThirdParty: boolean;
}

/** 默认路由表：按优先级排列，mock 兜底（无需三方） */
export const DEFAULT_LLM_ROUTING_TABLE: LlmRoutingProfile[] = [
  { provider: 'anthropic', model: 'claude-sonnet-4-6', requiresThirdParty: true },
  { provider: 'openai', model: 'gpt-4o', requiresThirdParty: true },
  { provider: 'azure-openai', model: 'gpt-4o', requiresThirdParty: true },
  { provider: 'mock', model: 'mock-model', requiresThirdParty: false },
];

export interface LlmRoutingContext {
  capabilities: {
    llm: boolean;
    thirdPartyAPI: boolean;
  };
  /** 覆盖路由表（测试或自定义部署） */
  routingTable?: LlmRoutingProfile[];
  /** 倾向提供商（best-effort，不满足条件时自动降级） */
  preferredProvider?: LlmProvider;
}

/**
 * Stage 1 路由逻辑：
 *   - capabilities.llm=false → null（调用方应 G0_BLOCK）
 *   - 按路由表顺序选出满足条件的第一条
 *   - preferredProvider 提升优先级，但不跳过条件检查
 *   - 若全部候选不满足（只剩 mock 且 thirdParty 未放行）→ 选 mock
 */
export function selectLlmRoute(ctx: LlmRoutingContext): LlmRouteDecision | null {
  if (!ctx.capabilities.llm) return null;

  const table = ctx.routingTable ?? DEFAULT_LLM_ROUTING_TABLE;
  const preferred = ctx.preferredProvider;

  // 构建候选列表：倾向提供商排前，其余保持原序
  const candidates: LlmRoutingProfile[] = preferred
    ? [...table.filter((p) => p.provider === preferred), ...table.filter((p) => p.provider !== preferred)]
    : table;

  for (const profile of candidates) {
    if (profile.requiresThirdParty && !ctx.capabilities.thirdPartyAPI) continue;
    return {
      provider: profile.provider,
      model: profile.model,
      rationale: buildRationale(profile, ctx, preferred),
    };
  }

  return null;
}

function buildRationale(
  profile: LlmRoutingProfile,
  ctx: LlmRoutingContext,
  preferred?: LlmProvider
): string {
  const cap = `llm=true thirdPartyAPI=${ctx.capabilities.thirdPartyAPI}`;
  const hint = preferred && preferred !== profile.provider ? ` (preferred=${preferred} unavailable, fallback)` : '';
  return `Route: ${profile.provider}/${profile.model} [${cap}]${hint}`;
}
