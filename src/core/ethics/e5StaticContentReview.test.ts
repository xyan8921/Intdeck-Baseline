import { describe, expect, it, afterEach } from 'vitest';
import type { Scenario } from '../ontology/types';
import {
  clearPresetTemplateE5HooksForTests,
  registerPresetTemplateE5Hook,
  reviewIntentRouteDescriptionForE5,
  reviewKeywordBundleTextForE5,
  reviewPresetScenarioForE5,
  reviewPresetScenarioForE5WithHooks,
} from './e5StaticContentReview';
import {
  ETHICS_RULE_E5_INTENT_ROUTE_EXCLUSIONARY_LANGUAGE,
  ETHICS_RULE_E5_INTENT_ROUTE_PASS_SCREEN,
} from './ruleIds';
import {
  ETHICS_RULE_E5_PRESET_TEMPLATE_EXCLUSIONARY_LANGUAGE,
  ETHICS_RULE_E5_PRESET_TEMPLATE_PASS_SCREEN,
} from './ruleIds';

const baseScenario = (): Scenario => ({
  id: 't1',
  name: 'Test',
  category: 'C端',
  promptTemplate: 'hello {{x}}',
  workflowId: 'wf',
  skills: ['text-generation'],
  ethicalPrinciples: ['E1', 'E5', 'E6'],
});

afterEach(() => {
  clearPresetTemplateE5HooksForTests();
});

describe('reviewPresetScenarioForE5', () => {
  it('blocks when visible text matches exclusionary pattern', () => {
    const s = baseScenario();
    s.name = '含有弱智字样的坏模板';
    const r = reviewPresetScenarioForE5(s);
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered[0]).toBe(ETHICS_RULE_E5_PRESET_TEMPLATE_EXCLUSIONARY_LANGUAGE);
  });

  it('passes clean template', () => {
    const r = reviewPresetScenarioForE5(baseScenario());
    expect(r.verdict).toBe('ok');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E5_PRESET_TEMPLATE_PASS_SCREEN);
  });

  it('runs extra hook after base pass', () => {
    registerPresetTemplateE5Hook((scenario) =>
      scenario.id === 'block-me'
        ? {
            verdict: 'block',
            scenarioId: scenario.id,
            rulesTriggered: ['ethics.e5.test.hook'],
            reason: 'hook',
          }
        : null
    );
    const s = baseScenario();
    s.id = 'block-me';
    const r = reviewPresetScenarioForE5WithHooks(s);
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain('ethics.e5.test.hook');
  });
});

describe('reviewKeywordBundleTextForE5', () => {
  it('blocks on exclusionary user input', () => {
    const r = reviewKeywordBundleTextForE5('note=弱智');
    expect(r.verdict).toBe('block');
  });

  it('passes benign input', () => {
    const r = reviewKeywordBundleTextForE5('budget=5000\ntheme=太空');
    expect(r.verdict).toBe('ok');
  });
});

describe('reviewIntentRouteDescriptionForE5', () => {
  it('uses intent-route rule ids', () => {
    const blocked = reviewIntentRouteDescriptionForE5('这里有脑残用词');
    expect(blocked.verdict).toBe('block');
    expect(blocked.rulesTriggered[0]).toBe(ETHICS_RULE_E5_INTENT_ROUTE_EXCLUSIONARY_LANGUAGE);

    const ok = reviewIntentRouteDescriptionForE5('策划一场儿童生日派对');
    expect(ok.verdict).toBe('ok');
    expect(ok.rulesTriggered).toContain(ETHICS_RULE_E5_INTENT_ROUTE_PASS_SCREEN);
  });
});
