/**
 * 出站敏感操作统一门面（Phase 3 前置）
 * 经 `EthicsGuard` 后再执行，便于与 `INTDONE_ETHICS_RULE_ALIGNMENT_v1.md` 收束及审计扩展。
 */
import { localEthicsGuard } from '../ethics/LocalEthicsGuard';

export type OutboundKind = 'office' | 'core-ai' | 'financial' | 'other';

export type RunOutboundOptions = {
  /** E2：为 true 时须在 UI 侧取得用户确认并传入 userConfirmed */
  requiresUserConfirmation?: boolean;
  /** 用户已确认执行该出站动作 */
  userConfirmed?: boolean;
};

/** 与 Core AI `subject.label` 域隔离，避免误走 `coreAiOutputEthics` */
const OUTBOUND_SUBJECT_LABEL = 'outbound_dispatch';

export async function runOutbound<T>(
  kind: OutboundKind,
  dispatchLabel: string,
  fn: () => Promise<T>,
  options?: RunOutboundOptions
): Promise<T> {
  const decision = await localEthicsGuard.checkCandidate({
    subject: {
      type: 'action',
      skillId: `outbound:${kind}`,
      label: OUTBOUND_SUBJECT_LABEL,
    },
    meta: { outboundKind: kind, dispatchLabel, ...options },
    candidate: {
      kind: 'outbound',
      outboundKind: kind,
      dispatchLabel,
      requiresUserConfirmation: options?.requiresUserConfirmation === true,
      userConfirmed: options?.userConfirmed === true,
    },
  });
  if (decision.verdict === 'block') {
    throw new Error(decision.reason || '出站动作被伦理规则拦截');
  }
  return fn();
}
