import type { EthicsGuard, EthicsInput } from './types';
import type { EthicsDecision } from '../ai/types';
import { appendUnifiedAuditRingEvent } from '../observability/unifiedAuditRingLog';
import { buildUnifiedAuditFromEthicsDecision } from '../observability/unifiedAuditSchema';
import { applyCoreAiOutputEthicsRules } from './coreAiOutputEthics';
import { applyE4RevocabilityEthicsRules } from './e4RevocabilityEthics';
import { applyFinancialExportEthicsRules } from './financialExportEthics';
import { applyOutboundEthicsRules } from './outboundEthics';

/**
 * LocalEthicsGuard —— `EthicsGuard` 的默认运行时实现（与元层分离）
 *
 * **说明**：Intdone 的伦理元层早已存在：`ETHICS.md` 宪章、`EthicsGuard`/`EthicsDecision` 契约、
 * Core AI 与 `evaluatePolicy` 中的调用链、以及已落地的 **LocalContentShield**、Skill 内嵌规则等。
 * 本类收敛顺序：**财务导出** → **出站（E2 确认闸）** → **Core AI（E3+E2）** → 默认 allow。
 * 详见 `docs/INTDONE_ETHICS_RULE_ALIGNMENT_v1.md`。
 */
export class LocalEthicsGuard implements EthicsGuard {
  async checkCandidate(input: EthicsInput): Promise<EthicsDecision> {
    let decision: EthicsDecision;
    const financial = applyFinancialExportEthicsRules(input);
    if (financial) {
      decision = financial;
    } else {
      const outbound = applyOutboundEthicsRules(input);
      if (outbound) {
        decision = outbound;
      } else {
        const e4 = applyE4RevocabilityEthicsRules(input);
        if (e4) {
          decision = e4;
        } else {
          const coreAi = applyCoreAiOutputEthicsRules(input);
          if (coreAi) {
            decision = coreAi;
          } else {
            decision = {
              verdict: 'allow',
              effectiveOutput: input.candidate,
            };
          }
        }
      }
    }
    this.appendRingIfApplicable(input, decision);
    return decision;
  }

  private appendRingIfApplicable(input: EthicsInput, decision: EthicsDecision): void {
    const sid = input.subject.skillId;
    const ring =
      sid === 'financial-export' ||
      (typeof sid === 'string' && sid.startsWith('outbound:')) ||
      sid === 'deliverable:metadata' ||
      sid === 'execution:undo';
    if (!ring) return;
    appendUnifiedAuditRingEvent(
      buildUnifiedAuditFromEthicsDecision(decision, {
        ethicsSubjectSkillId: sid,
        ethicsSubjectLabel: input.subject.label,
      })
    );
  }

  /** 结构化伦理审计日志：待与 AiCore 日志策略对齐后实现 */
  async logEvent(_event: unknown): Promise<void> {
    return;
  }
}

export const localEthicsGuard = new LocalEthicsGuard();
