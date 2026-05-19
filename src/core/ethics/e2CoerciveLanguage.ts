import type { EthicsDecision } from '../ai/types';
import { ETHICS_RULE_E2_CORE_COERCIVE_LANGUAGE } from './ruleIds';

/**
 * E2：检测操纵/胁迫类表述（暗黑模式、情感绑架），见 `ETHICS.md` E2。
 * 规则保守：仅匹配明确高风险短语，避免误杀正常业务用语。
 */
const COERCIVE: { hint: string; re: RegExp }[] = [
  { hint: 'zh:incomplete-then-delete', re: /不完成[^。]{0,20}(就|将)?\s*删除/ },
  { hint: 'zh:pay-or-lose', re: /不(支付|付款)[^。]{0,12}(就|将)?\s*(冻结|封号|删除)/ },
  { hint: 'zh:urgent-or-else', re: /(立即|马上)[^。]{0,8}(否则|不然)[^。]{0,8}(封号|删除|清空)/ },
  { hint: 'zh:last-chance', re: /(最后机会|再不).{0,12}(将|就).{0,8}(删除|清空|失效)/ },
  { hint: 'zh:account-deleted', re: /账户[^。]{0,10}(将|会).{0,8}删\s*除/ },
  { hint: 'en:act-now-or', re: /act\s+now\s+or.{0,30}(delete|lose|suspend)/i },
  {
    hint: 'en:account-will-be-deleted',
    re: /your\s+account.{0,25}(will\s+be\s+)?(deleted|terminated|suspended)/i,
  },
];

function collectStrings(val: unknown, depth: number, out: string[], budget: { n: number }): void {
  if (budget.n >= 48 || depth > 6) return;
  if (typeof val === 'string') {
    if (val.trim()) {
      out.push(val);
      budget.n += val.length;
    }
    return;
  }
  if (Array.isArray(val)) {
    for (const x of val) collectStrings(x, depth + 1, out, budget);
    return;
  }
  if (val && typeof val === 'object') {
    for (const v of Object.values(val)) collectStrings(v, depth + 1, out, budget);
  }
}

/**
 * 若命中胁迫表述则返回 block；否则返回 null。
 */
export function scanCoreAiCandidateForCoerciveLanguage(
  candidate: unknown,
  _stageLabel: string
): EthicsDecision | null {
  const texts: string[] = [];
  collectStrings(candidate, 0, texts, { n: 0 });
  const blob = texts.join('\n');
  for (const { hint, re } of COERCIVE) {
    if (re.test(blob)) {
      return {
        verdict: 'block',
        reason: `CORE_AI_ETHICS: coercive or manipulative wording detected (${hint}) (E2).`,
        rulesTriggered: [ETHICS_RULE_E2_CORE_COERCIVE_LANGUAGE, hint],
      };
    }
  }
  return null;
}
