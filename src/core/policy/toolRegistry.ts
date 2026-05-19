/**
 * ToolRegistry（Sprint A）：工具注册表与 policy gate 统一入口。
 *
 * 设计原则：
 *   - 新工具调用 `globalToolRegistry.register(...)` 完成注册，无需修改任何核心 gate 文件。
 *   - Capability enforcement 在 `evaluateGate` 内统一执行（manifest.capabilities 约束）。
 *   - `evaluatePolicy` 及 `runG0OutboundAction` 均委托此处，保证"单一入口"原则。
 *
 * @see INTDONE_INTDECK_ARCHITECTURE_AND_TECH_DESIGN_v1.md §P1 Tool registry + policy gate
 */

import type { IntdeckAgentRuntimeManifestV1 } from '../experience/experienceTypes';
import type { EthicsGuard } from '../ethics/types';

// ─────────────────────────────────────────────────────────────────────────────
// 公共类型
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolGateOptions {
  /** 可注入 mock EthicsGuard（测试用）；默认 localEthicsGuard */
  ethicsGuard?: EthicsGuard;
  /** 若提供，则在调用 evaluate 前强制检查 capability 约束 */
  manifest?: IntdeckAgentRuntimeManifestV1;
}

/**
 * ToolGateResult：registry 层统一结果。
 * 内置工具（如 financial-export）返回的 `PolicyEvaluationResult` 是其结构超集，
 * 调用方可安全 cast：`result as PolicyEvaluationResult`。
 */
export interface ToolGateResult {
  verdict: 'allow' | 'deny';
  /** 触发此结果的规则 ID（audit 可追溯） */
  ruleId: string;
  /** 稳定的机器可读错误码（deny 时填写） */
  code?: string;
  reason?: string;
}

/** 工具 gate 评估函数签名 */
export type ToolGateEvaluator<TReq = unknown> = (
  req: TReq,
  options?: ToolGateOptions
) => Promise<ToolGateResult>;

export interface ToolRegistration<TReq = unknown> {
  /** 唯一标识，与 `PolicyEvaluationRequest.kind` 或 outbound 路由对齐 */
  toolId: string;
  description?: string;
  ethicalPrinciples?: string[];
  /** 该工具是否需要网络出站（用于 networkEgress capability 执行） */
  requiresNetworkEgress?: boolean;
  /** 该工具是否调用第三方 API（用于 thirdPartyAPI capability 执行） */
  requiresThirdPartyAPI?: boolean;
  evaluate: ToolGateEvaluator<TReq>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolRegistry
// ─────────────────────────────────────────────────────────────────────────────

export class ToolRegistry {
  private readonly _tools = new Map<string, ToolRegistration>();

  /**
   * 注册一个工具的 policy gate。
   * 同一 toolId 注册两次会覆盖（最后注册有效，便于测试注入）。
   */
  register<T>(reg: ToolRegistration<T>): void {
    this._tools.set(reg.toolId, reg as ToolRegistration);
  }

  hasTool(toolId: string): boolean {
    return this._tools.has(toolId);
  }

  listTools(): Array<Pick<ToolRegistration, 'toolId' | 'description' | 'ethicalPrinciples'>> {
    return Array.from(this._tools.values()).map(({ toolId, description, ethicalPrinciples }) => ({
      toolId,
      description,
      ethicalPrinciples,
    }));
  }

  getRequirements(
    toolId: string
  ): Pick<ToolRegistration, 'requiresNetworkEgress' | 'requiresThirdPartyAPI'> | undefined {
    const reg = this._tools.get(toolId);
    if (!reg) return undefined;
    return {
      requiresNetworkEgress: reg.requiresNetworkEgress,
      requiresThirdPartyAPI: reg.requiresThirdPartyAPI,
    };
  }

  /**
   * 对工具调用执行 policy gate：
   *   1. 检查工具是否已注册（未注册 → deny）
   *   2. 若提供 manifest，强制检查 capability 约束（networkEgress / thirdPartyAPI）
   *   3. 调用注册的 evaluate 函数
   */
  async evaluateGate(
    toolId: string,
    req: unknown,
    options?: ToolGateOptions
  ): Promise<ToolGateResult> {
    const reg = this._tools.get(toolId);
    if (!reg) {
      return {
        verdict: 'deny',
        ruleId: 'tool-registry.unknown-tool',
        code: 'TOOL_NOT_REGISTERED',
        reason: `工具 "${toolId}" 未在 ToolRegistry 注册`,
      };
    }

    // Capability enforcement（manifest 存在时执行）
    if (options?.manifest) {
      const { capabilities } = options.manifest;

      if (capabilities.networkEgress === 'deny' && reg.requiresNetworkEgress) {
        return {
          verdict: 'deny',
          ruleId: 'tool-registry.capability.network-egress',
          code: 'CAPABILITY_NETWORK_EGRESS_DENIED',
          reason: `capabilities.networkEgress=deny 阻止工具 "${toolId}" 的出站调用`,
        };
      }

      if (capabilities.thirdPartyAPI === false && reg.requiresThirdPartyAPI) {
        return {
          verdict: 'deny',
          ruleId: 'tool-registry.capability.third-party-api',
          code: 'CAPABILITY_THIRD_PARTY_API_DENIED',
          reason: `capabilities.thirdPartyAPI=false 阻止工具 "${toolId}" 调用第三方 API`,
        };
      }
    }

    return reg.evaluate(req, options);
  }
}

/** 全局 ToolRegistry 单例；内置工具在 `builtinTools.ts` 中注册（import 副作用）。 */
export const globalToolRegistry = new ToolRegistry();
