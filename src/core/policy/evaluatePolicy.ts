/**
 * 统一策略入口（Sprint A 重构）：委托给 globalToolRegistry，不再内联 switch-case。
 *
 * 调用方无感知变化——签名与返回类型与重构前完全一致。
 * 内置工具（financial-export）在 `builtinTools.ts` 注册，import 副作用自动触发。
 * 新增工具调用 `globalToolRegistry.register(...)` 即可，无需修改本文件。
 */

import './builtinTools'; // 副作用：注册内置工具到 globalToolRegistry
import { globalToolRegistry } from './toolRegistry';
import type { EthicsGuard } from '../ethics/types';
import type { PolicyEvaluationRequest, PolicyEvaluationResult } from './types';

export type EvaluatePolicyOptions = {
  /** 默认 LocalEthicsGuard；测试可注入 mock */
  ethicsGuard?: EthicsGuard;
};

/**
 * 统一策略入口（异步）：将 request.kind 路由到 ToolRegistry 中对应的 gate 函数。
 * 未注册的 kind 返回 deny（fail-closed）。
 */
export async function evaluatePolicy(
  request: PolicyEvaluationRequest,
  options?: EvaluatePolicyOptions
): Promise<PolicyEvaluationResult> {
  const result = await globalToolRegistry.evaluateGate(request.kind, request, {
    ethicsGuard: options?.ethicsGuard,
  });
  // 注册的 evaluator 返回 PolicyEvaluationResult（ToolGateResult 的结构超集），cast 安全
  return result as PolicyEvaluationResult;
}
