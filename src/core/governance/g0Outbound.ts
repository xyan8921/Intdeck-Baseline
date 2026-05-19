import { runOutbound, type OutboundKind, type RunOutboundOptions } from '../outbound/runOutbound';
import { globalToolRegistry } from '../policy/toolRegistry';
import type { IntdeckAgentRuntimeManifestV1 } from '../experience/experienceTypes';
import { runG0Action } from './g0Shell';
import type { G0ActorContext, G0CorrelationKeys, G0PurposeScope } from './g0Types';

/**
 * G0 Pre-Tool/Outbound Gate（Sprint A 扩展）：
 *   1. 可选 manifest 注入 → capability enforcement（networkEgress / thirdPartyAPI）
 *   2. ToolRegistry capability gate（若工具已注册）
 *   3. runOutbound（Ethics guard + fn 执行）
 *   4. G0 审计报告写入
 *
 * 背景：`IntdeckAgentRuntimeManifest.capabilities` 此前只声明不执行，Sprint A 将其真正守住。
 */
export async function runG0OutboundAction<T>(input: {
  kind: OutboundKind;
  dispatchLabel: string;
  actor: G0ActorContext;
  purposeScope: G0PurposeScope;
  correlation?: G0CorrelationKeys;
  options?: RunOutboundOptions;
  /**
   * 若提供，在 ToolRegistry gate 之前强制检查 manifest.capabilities 约束。
   * 不提供时保持原行为（仅 EthicsGuard）。
   */
  manifest?: IntdeckAgentRuntimeManifestV1;
  fn: () => Promise<T>;
}): Promise<T> {
  // ── Capability enforcement ─────────────────────────────────────────────────
  if (input.manifest) {
    const { capabilities } = input.manifest;
    const toolId = `outbound:${input.kind}`;
    const reqs = globalToolRegistry.getRequirements(toolId);

    // networkEgress=deny：阻止所有声明需要出站的工具
    if (capabilities.networkEgress === 'deny') {
      // 已注册且显式声明 requiresNetworkEgress，或未注册的出站（默认视为需网络）
      const needsEgress = reqs ? (reqs.requiresNetworkEgress ?? true) : true;
      if (needsEgress) {
        throw new Error(
          `G0_BLOCK: capabilities.networkEgress=deny 阻止出站 kind=${input.kind} dispatchLabel=${input.dispatchLabel}`
        );
      }
    }

    // thirdPartyAPI=false：阻止显式声明第三方 API 的已注册工具
    if (capabilities.thirdPartyAPI === false && reqs?.requiresThirdPartyAPI === true) {
      throw new Error(
        `G0_BLOCK: capabilities.thirdPartyAPI=false 阻止出站 kind=${input.kind} dispatchLabel=${input.dispatchLabel}`
      );
    }
  }

  // ── G0 包壳 → runOutbound → fn ────────────────────────────────────────────
  const res = await runG0Action({
    module: 'governance',
    action: `outbound:${input.kind}:${input.dispatchLabel}`,
    actor: input.actor,
    purposeScope: input.purposeScope,
    correlation: input.correlation,
    inputSnapshot: {
      kind: input.kind,
      dispatchLabel: input.dispatchLabel,
      options: input.options ?? {},
      ...(input.manifest ? { manifestLabel: input.manifest.label, capabilityHash: input.manifest.configSha256 } : {}),
    },
    fn: async () =>
      runOutbound(input.kind, input.dispatchLabel, input.fn, input.options) as unknown as Promise<T>,
  });
  if (!res.ok) {
    throw new Error(res.report.summary.result.errorMessage || 'G0 outbound failed');
  }
  return res.output as T;
}
