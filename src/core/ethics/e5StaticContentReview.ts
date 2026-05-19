/**
 * E5：预置模板与关键词束等 **静态内容** 的包容性扫描（与 Core AI 输出屏共享短语表）。
 */
import type { Scenario } from '../ontology/types';
import { scanPlainTextForExclusionaryLanguage } from './e5ExclusionaryLanguage';
import {
  ETHICS_RULE_E5_INTENT_ROUTE_EXCLUSIONARY_LANGUAGE,
  ETHICS_RULE_E5_INTENT_ROUTE_PASS_SCREEN,
  ETHICS_RULE_E5_KEYWORD_BUNDLE_EXCLUSIONARY_LANGUAGE,
  ETHICS_RULE_E5_KEYWORD_BUNDLE_PASS_SCREEN,
  ETHICS_RULE_E5_PRESET_TEMPLATE_E5_NOT_DECLARED,
  ETHICS_RULE_E5_PRESET_TEMPLATE_EXCLUSIONARY_LANGUAGE,
  ETHICS_RULE_E5_PRESET_TEMPLATE_PASS_SCREEN,
} from './ruleIds';

export interface E5Advisory {
  ruleId: string;
  message: string;
}

export interface PresetTemplateE5ReviewResult {
  verdict: 'ok' | 'block';
  scenarioId: string;
  rulesTriggered: string[];
  reason?: string;
  hint?: string;
  advisory?: E5Advisory[];
}

export interface KeywordBundleE5ReviewResult {
  verdict: 'ok' | 'block';
  rulesTriggered: string[];
  reason?: string;
  hint?: string;
}

/** 与关键词束同形；ruleId 使用 `ethics.e5.intent-route.*` */
export type IntentRouteE5ReviewResult = KeywordBundleE5ReviewResult;

const presetHooks: Array<(s: Scenario) => PresetTemplateE5ReviewResult | null> = [];

export function registerPresetTemplateE5Hook(
  hook: (s: Scenario) => PresetTemplateE5ReviewResult | null
): void {
  presetHooks.push(hook);
}

/** @internal 测试用 */
export function clearPresetTemplateE5HooksForTests(): void {
  presetHooks.length = 0;
}

function scenarioVisibleText(s: Scenario): string {
  const parts: string[] = [s.name, s.scenario ?? '', s.promptTemplate];
  if (s.tags?.length) parts.push(s.tags.join(' '));
  const ex = s.exampleOutput as { title?: string; content?: string } | undefined;
  if (ex?.title) parts.push(ex.title);
  if (ex?.content) parts.push(ex.content);
  return parts.join('\n');
}

export function reviewPresetScenarioForE5(scenario: Scenario): PresetTemplateE5ReviewResult {
  const blob = scenarioVisibleText(scenario);
  const hit = scanPlainTextForExclusionaryLanguage(blob);
  if (hit) {
    return {
      verdict: 'block',
      scenarioId: scenario.id,
      rulesTriggered: [ETHICS_RULE_E5_PRESET_TEMPLATE_EXCLUSIONARY_LANGUAGE, hit.hint],
      reason: `PRESET_TEMPLATE_E5: exclusionary or biased wording (${hit.hint}).`,
      hint: hit.hint,
    };
  }

  const advisory: E5Advisory[] = [];
  if (!scenario.ethicalPrinciples?.includes('E5')) {
    advisory.push({
      ruleId: ETHICS_RULE_E5_PRESET_TEMPLATE_E5_NOT_DECLARED,
      message: 'ethicalPrinciples 未包含 E5；建议在预置模板 metadata 中声明以便与包容性策略对齐。',
    });
  }

  return {
    verdict: 'ok',
    scenarioId: scenario.id,
    rulesTriggered: [ETHICS_RULE_E5_PRESET_TEMPLATE_PASS_SCREEN],
    advisory: advisory.length ? advisory : undefined,
  };
}

export function reviewPresetScenarioForE5WithHooks(scenario: Scenario): PresetTemplateE5ReviewResult {
  const base = reviewPresetScenarioForE5(scenario);
  if (base.verdict === 'block') return base;
  for (const h of presetHooks) {
    const r = h(scenario);
    if (r?.verdict === 'block') return r;
  }
  return base;
}

export function reviewKeywordBundleTextForE5(text: string): KeywordBundleE5ReviewResult {
  const hit = scanPlainTextForExclusionaryLanguage(text);
  if (hit) {
    return {
      verdict: 'block',
      rulesTriggered: [ETHICS_RULE_E5_KEYWORD_BUNDLE_EXCLUSIONARY_LANGUAGE, hit.hint],
      hint: hit.hint,
      reason: `KEYWORD_BUNDLE_E5: exclusionary wording (${hit.hint}).`,
    };
  }
  return {
    verdict: 'ok',
    rulesTriggered: [ETHICS_RULE_E5_KEYWORD_BUNDLE_PASS_SCREEN],
  };
}

/** 意图路由 / 落地页「一句话」路径：与 Core AI 相同的排斥性短语表 */
export function reviewIntentRouteDescriptionForE5(text: string): IntentRouteE5ReviewResult {
  const hit = scanPlainTextForExclusionaryLanguage(text);
  if (hit) {
    return {
      verdict: 'block',
      rulesTriggered: [ETHICS_RULE_E5_INTENT_ROUTE_EXCLUSIONARY_LANGUAGE, hit.hint],
      hint: hit.hint,
      reason: `INTENT_ROUTE_E5: exclusionary wording (${hit.hint}).`,
    };
  }
  return {
    verdict: 'ok',
    rulesTriggered: [ETHICS_RULE_E5_INTENT_ROUTE_PASS_SCREEN],
  };
}
