/**
 * 内置工具注册（Sprint A）：将 financial-export policy gate 注册到 globalToolRegistry。
 *
 * 本文件作为副作用模块被 `evaluatePolicy.ts` import，无需显式调用；
 * 新工具仿此模式，在自己的文件里调用 `globalToolRegistry.register(...)` 即可。
 *
 * @see toolRegistry.ts
 * @see evaluatePolicy.ts
 */

import { shouldRequirePolicySnapshotForFinancialExport } from '../../config/policyEvaluation';
import { loadPolicyStoreState } from '../backend-contract/policyStore';
import { localEthicsGuard } from '../ethics/LocalEthicsGuard';
import { validateFinancialExportPermission } from '../financial/exportPolicy';
import { globalToolRegistry, type ToolGateEvaluator, type ToolGateOptions } from './toolRegistry';
import {
  FINANCIAL_EXPORT_ETHICS_RULE_ID,
  FINANCIAL_EXPORT_MATRIX_RULE_ID,
  FINANCIAL_EXPORT_POLICY_RULE_ID,
  type PolicyEvaluationRequest,
  type PolicyEvaluationResult,
} from './types';

const FLAG_ENABLE_FINANCIAL_EXPORT = 'enableFinancialExport';

async function evaluateFinancialExportGate(
  req: unknown,
  options?: ToolGateOptions
): Promise<PolicyEvaluationResult> {
  const request = req as Extract<PolicyEvaluationRequest, { kind: 'financial-export' }>;
  const ethics = options?.ethicsGuard ?? localEthicsGuard;
  const snapshot = loadPolicyStoreState().current;
  const policyVersion = snapshot?.version;

  if (shouldRequirePolicySnapshotForFinancialExport() && !snapshot) {
    return {
      verdict: 'deny',
      kind: 'financial-export',
      ruleId: FINANCIAL_EXPORT_POLICY_RULE_ID,
      code: 'EXPORT_DENIED_POLICY_UNAVAILABLE',
      reason:
        'EXPORT_DENIED: policy snapshot required but none loaded (set VITE_POLICY_REQUIRE_SNAPSHOT=false to allow lenient mode in prod, or refresh policy in Dev).',
      actorType: request.actorType,
      dataSensitivity: request.dataSensitivity,
    };
  }

  const exportEnabled = snapshot?.flags[FLAG_ENABLE_FINANCIAL_EXPORT];
  if (snapshot && exportEnabled === false) {
    return {
      verdict: 'deny',
      kind: 'financial-export',
      ruleId: FINANCIAL_EXPORT_POLICY_RULE_ID,
      code: 'EXPORT_DENIED_POLICY_DISABLED',
      reason:
        'EXPORT_DENIED: financial export disabled by policy snapshot (enableFinancialExport=false).',
      actorType: request.actorType,
      dataSensitivity: request.dataSensitivity,
      policyVersion: snapshot.version,
    };
  }

  const ethicsDecision = await ethics.checkCandidate({
    subject: {
      type: 'action',
      skillId: 'financial-export',
      label: 'Financial CSV export',
    },
    meta: {
      policyVersion: snapshot?.version,
      actorType: request.actorType,
      dataSensitivity: request.dataSensitivity,
    },
    candidate: {
      kind: 'financial-export',
      actorType: request.actorType,
      dataSensitivity: request.dataSensitivity,
    },
  });

  if (ethicsDecision.verdict === 'block' || ethicsDecision.verdict === 'revise') {
    return {
      verdict: 'deny',
      kind: 'financial-export',
      ruleId: FINANCIAL_EXPORT_ETHICS_RULE_ID,
      code: 'EXPORT_DENIED_ETHICS',
      reason:
        ethicsDecision.reason?.trim() ||
        `EXPORT_DENIED: ethics ${ethicsDecision.verdict} (financial export).`,
      actorType: request.actorType,
      dataSensitivity: request.dataSensitivity,
      ...(policyVersion ? { policyVersion } : {}),
    };
  }

  const inner = validateFinancialExportPermission({
    actorType: request.actorType,
    dataSensitivity: request.dataSensitivity,
  });

  if (inner.allowed) {
    return {
      verdict: 'allow',
      kind: 'financial-export',
      ruleId: FINANCIAL_EXPORT_MATRIX_RULE_ID,
      actorType: request.actorType,
      dataSensitivity: request.dataSensitivity,
      ...(policyVersion ? { policyVersion } : {}),
    };
  }

  return {
    verdict: 'deny',
    kind: 'financial-export',
    ruleId: FINANCIAL_EXPORT_MATRIX_RULE_ID,
    code: inner.code as Exclude<
      import('../backend-contract/types').FinancialExportDenialCode,
      'EXPORT_DENIED_POLICY_DISABLED' | 'EXPORT_DENIED_POLICY_UNAVAILABLE' | 'EXPORT_DENIED_ETHICS'
    >,
    reason: inner.reason,
    actorType: request.actorType,
    dataSensitivity: request.dataSensitivity,
    ...(policyVersion ? { policyVersion } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 注册内置工具
// ─────────────────────────────────────────────────────────────────────────────

globalToolRegistry.register({
  toolId: 'financial-export',
  description: '财务数据导出（CSV）：策略快照门禁 → 伦理校验 → 角色敏感度矩阵',
  ethicalPrinciples: ['E3', 'E6'],
  requiresNetworkEgress: false,
  requiresThirdPartyAPI: false,
  // PolicyEvaluationResult ⊃ ToolGateResult（均含 verdict + ruleId），cast 安全
  evaluate: evaluateFinancialExportGate as ToolGateEvaluator,
});
