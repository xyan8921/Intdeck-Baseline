import type { EthicsDecision } from '../ai/types';
import { ETHICS_RULE_E5_CORE_EXCLUSIONARY_LANGUAGE } from './ruleIds';

/**
 * E5：排斥性 / 族群或刻板印象类高风险表述（保守短语表，与 `ETHICS.md` E5 对齐）。
 */
const EXCLUSIONARY: { hint: string; re: RegExp }[] = [
  { hint: 'zh:slur-mental', re: /弱智|脑残/ },
  { hint: 'zh:gender-stereotype', re: /(男人|女人)[^。]{0,8}就该/ },
  { hint: 'en:slur-r', re: /\b(r(?:e)?tard(?:ed)?)\b/i },
  {
    hint: 'en:discriminatory-hiring',
    re: /\b(no|only)\s+(women|men|males|females|boys|girls)\b/i,
  },
];

/** 对纯文本做与 Core AI 相同的排斥性短语扫描（预置模板 / 关键词束等静态内容复用） */
export function scanPlainTextForExclusionaryLanguage(text: string): { hint: string } | null {
  const blob = text.trim();
  if (!blob) return null;
  for (const { hint, re } of EXCLUSIONARY) {
    if (re.test(blob)) {
      return { hint };
    }
  }
  return null;
}

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

/** 若命中排斥性表述则返回 block；否则返回 null */
export function scanCoreAiCandidateForExclusionaryLanguage(
  candidate: unknown,
  _stageLabel: string
): EthicsDecision | null {
  const texts: string[] = [];
  collectStrings(candidate, 0, texts, { n: 0 });
  const blob = texts.join('\n');
  const hit = scanPlainTextForExclusionaryLanguage(blob);
  if (hit) {
    return {
      verdict: 'block',
      reason: `CORE_AI_ETHICS: exclusionary or biased wording detected (${hit.hint}) (E5).`,
      rulesTriggered: [ETHICS_RULE_E5_CORE_EXCLUSIONARY_LANGUAGE, hit.hint],
    };
  }
  return null;
}
