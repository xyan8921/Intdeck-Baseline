import { describe, expect, it } from 'vitest';
import {
  buildUnifiedAuditEventV1,
  buildUnifiedAuditForCoreAiStep,
  buildUnifiedAuditFromEthicsDecision,
  inferAuditSurfaceFromRuleId,
  normalizeRulesTriggered,
} from './unifiedAuditSchema';
import { ETHICS_RULE_E1_SHIELD_BLOCKLIST_HIT } from '@/core/shield/ruleIds';
import {
  ETHICS_RULE_E2_CORE_COERCIVE_LANGUAGE,
  ETHICS_RULE_E2_OUTBOUND_CONFIRM_REQUIRED,
  ETHICS_RULE_E4_DELIVERABLE_PASS_SCREEN,
  ETHICS_RULE_E6_FIN_EXPORT_PASS_SCREEN,
  ETHICS_RULE_E5_CORE_EXCLUSIONARY_LANGUAGE,
  ETHICS_RULE_E5_PRESET_TEMPLATE_EXCLUSIONARY_LANGUAGE,
  ETHICS_RULE_E5_INTENT_ROUTE_EXCLUSIONARY_LANGUAGE,
} from '@/core/ethics/ruleIds';

describe('inferAuditSurfaceFromRuleId', () => {
  it('maps shield', () => {
    expect(inferAuditSurfaceFromRuleId(ETHICS_RULE_E1_SHIELD_BLOCKLIST_HIT)).toBe('content_shield');
  });
  it('maps core ai', () => {
    expect(inferAuditSurfaceFromRuleId(ETHICS_RULE_E2_CORE_COERCIVE_LANGUAGE)).toBe('core_ai');
    expect(inferAuditSurfaceFromRuleId(ETHICS_RULE_E5_CORE_EXCLUSIONARY_LANGUAGE)).toBe('core_ai');
  });
  it('maps outbound', () => {
    expect(inferAuditSurfaceFromRuleId(ETHICS_RULE_E2_OUTBOUND_CONFIRM_REQUIRED)).toBe('outbound');
  });
  it('maps workflow (E4)', () => {
    expect(inferAuditSurfaceFromRuleId(ETHICS_RULE_E4_DELIVERABLE_PASS_SCREEN)).toBe('workflow');
  });
  it('maps financial export', () => {
    expect(inferAuditSurfaceFromRuleId(ETHICS_RULE_E6_FIN_EXPORT_PASS_SCREEN)).toBe('financial_export');
  });
  it('maps E5 static / intent', () => {
    expect(inferAuditSurfaceFromRuleId(ETHICS_RULE_E5_PRESET_TEMPLATE_EXCLUSIONARY_LANGUAGE)).toBe(
      'intent_static',
    );
    expect(inferAuditSurfaceFromRuleId(ETHICS_RULE_E5_INTENT_ROUTE_EXCLUSIONARY_LANGUAGE)).toBe(
      'intent_static',
    );
  });
  it('returns unknown for empty or unrecognized', () => {
    expect(inferAuditSurfaceFromRuleId('')).toBe('unknown');
    expect(inferAuditSurfaceFromRuleId('ethics.e9.future-rule')).toBe('unknown');
  });
});

describe('normalizeRulesTriggered', () => {
  it('dedupes and trims', () => {
    expect(normalizeRulesTriggered([' a ', 'a', 'b'])).toEqual(['a', 'b']);
  });
  it('handles nullish', () => {
    expect(normalizeRulesTriggered(undefined)).toEqual([]);
    expect(normalizeRulesTriggered(null)).toEqual([]);
  });
});

describe('buildUnifiedAuditFromEthicsDecision', () => {
  it('maps ethics decision to envelope', () => {
    const ev = buildUnifiedAuditFromEthicsDecision(
      {
        verdict: 'block',
        reason: 'x',
        rulesTriggered: ['ethics.e2.outbound.user-confirmation-required'],
      },
      { k: 1 },
    );
    expect(ev.surface).toBe('outbound');
    expect(ev.correlation).toMatchObject({ k: 1 });
  });
});

describe('buildUnifiedAuditForCoreAiStep', () => {
  it('merges shield rules before ethics', () => {
    const ev = buildUnifiedAuditForCoreAiStep({
      ethics: { verdict: 'allow', rulesTriggered: ['ethics.e2.core-ai.output.pass-screen'] },
      additionalRules: ['ethics.e1.shield.regex-hit'],
    });
    expect(ev.rulesTriggered).toEqual(
      expect.arrayContaining([
        'ethics.e1.shield.regex-hit',
        'ethics.e2.core-ai.output.pass-screen',
      ]),
    );
    expect(ev.surface).toBe('unknown');
  });
  it('ethics-only matches single surface', () => {
    const ev = buildUnifiedAuditForCoreAiStep({
      ethics: { verdict: 'revise', rulesTriggered: ['ethics.e3.core-ai.plan-output-invalid'] },
    });
    expect(ev.surface).toBe('core_ai');
  });
});

describe('buildUnifiedAuditEventV1', () => {
  it('single surface from rules', () => {
    const ev = buildUnifiedAuditEventV1({
      rulesTriggered: [ETHICS_RULE_E2_CORE_COERCIVE_LANGUAGE],
      verdict: 'block',
    });
    expect(ev.schemaVersion).toBe(1);
    expect(ev.surface).toBe('core_ai');
    expect(ev.rulesTriggered).toHaveLength(1);
    expect(ev.surfacesByRule?.[0]?.surface).toBe('core_ai');
  });
  it('mixed surfaces → surface unknown', () => {
    const ev = buildUnifiedAuditEventV1({
      rulesTriggered: [ETHICS_RULE_E2_CORE_COERCIVE_LANGUAGE, ETHICS_RULE_E1_SHIELD_BLOCKLIST_HIT],
      verdict: 'block',
    });
    expect(ev.surface).toBe('unknown');
    expect(ev.surfacesByRule).toHaveLength(2);
  });
  it('empty rules + surfaceHint', () => {
    const ev = buildUnifiedAuditEventV1({
      rulesTriggered: [],
      verdict: 'allow',
      surfaceHint: 'outbound',
    });
    expect(ev.surface).toBe('outbound');
  });
});
