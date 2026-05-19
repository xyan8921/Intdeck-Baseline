import { beforeEach, describe, expect, it } from 'vitest';
import { LocalEthicsGuard } from './LocalEthicsGuard';
import {
  ETHICS_RULE_E2_CORE_COERCIVE_LANGUAGE,
  ETHICS_RULE_E2_CORE_OUTPUT_PASS,
  ETHICS_RULE_E2_OUTBOUND_CONFIRM_REQUIRED,
  ETHICS_RULE_E2_OUTBOUND_PASS,
  ETHICS_RULE_E3_CORE_CLARIFY_INVALID,
  ETHICS_RULE_E3_CORE_CLARIFY_PASS,
  ETHICS_RULE_E3_CORE_KEYWORDS_INVALID,
  ETHICS_RULE_E3_CORE_KEYWORDS_PASS,
  ETHICS_RULE_E3_CORE_PLAN_INVALID,
  ETHICS_RULE_E3_CORE_PLAN_PASS,
  ETHICS_RULE_E3_CORE_VARIATION_INVALID,
  ETHICS_RULE_E3_CORE_VARIATION_PASS,
  ETHICS_RULE_E3_FIN_EXPORT_CANDIDATE_INVALID,
  ETHICS_RULE_E3_OUTBOUND_CANDIDATE_INVALID,
  ETHICS_RULE_E4_DELIVERABLE_MISSING_UNDO_TOKEN,
  ETHICS_RULE_E4_DELIVERABLE_PASS_SCREEN,
  ETHICS_RULE_E4_DELIVERABLE_UNDO_TOKEN_MALFORMED,
  ETHICS_RULE_E4_UNDO_CANDIDATE_INVALID,
  ETHICS_RULE_E4_UNDO_PASS_SCREEN,
  ETHICS_RULE_E4_UNDO_TOKEN_MALFORMED,
  ETHICS_RULE_E5_CORE_EXCLUSIONARY_LANGUAGE,
  ETHICS_RULE_E5_CORE_OUTPUT_PASS,
  ETHICS_RULE_E6_FIN_EXPORT_L4_AUDIT_ONLY,
  ETHICS_RULE_E6_FIN_EXPORT_OPERATOR_SENSITIVITY_CAP,
  ETHICS_RULE_E6_FIN_EXPORT_PASS_SCREEN,
} from './ruleIds';

const guard = new LocalEthicsGuard();

beforeEach(() => {
  try {
    localStorage.removeItem('intdone_unified_audit_ring_v1');
  } catch {
    // ignore
  }
});

describe('LocalEthicsGuard financial-export rules', () => {
  it('allows audit + L4 with pass-screen rule', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'financial-export', label: 'x' },
      meta: {},
      candidate: { kind: 'financial-export', actorType: 'audit', dataSensitivity: 'L4' },
    });
    expect(r.verdict).toBe('allow');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E6_FIN_EXPORT_PASS_SCREEN);
  });

  it('blocks finance + L4 (E6 l4-audit-only)', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'financial-export', label: 'x' },
      meta: {},
      candidate: { kind: 'financial-export', actorType: 'finance', dataSensitivity: 'L4' },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E6_FIN_EXPORT_L4_AUDIT_ONLY);
  });

  it('blocks operator + L3 (E6 operator cap, before matrix)', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'financial-export', label: 'x' },
      meta: {},
      candidate: { kind: 'financial-export', actorType: 'operator', dataSensitivity: 'L3' },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E6_FIN_EXPORT_OPERATOR_SENSITIVITY_CAP);
  });

  it('blocks invalid candidate shape (E3)', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'financial-export', label: 'x' },
      meta: {},
      candidate: { kind: 'financial-export', actorType: 'nope', dataSensitivity: 'L2' },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E3_FIN_EXPORT_CANDIDATE_INVALID);
  });
});

describe('LocalEthicsGuard outbound (E2)', () => {
  it('allows outbound without confirmation requirement', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'outbound:financial', label: 'outbound_dispatch' },
      meta: {},
      candidate: {
        kind: 'outbound',
        outboundKind: 'financial',
        dispatchLabel: 'x',
        requiresUserConfirmation: false,
        userConfirmed: false,
      },
    });
    expect(r.verdict).toBe('allow');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E2_OUTBOUND_PASS);
  });

  it('blocks outbound when confirmation required but not given', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'outbound:office', label: 'outbound_dispatch' },
      meta: {},
      candidate: {
        kind: 'outbound',
        outboundKind: 'office',
        dispatchLabel: 'send',
        requiresUserConfirmation: true,
        userConfirmed: false,
      },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E2_OUTBOUND_CONFIRM_REQUIRED);
  });

  it('blocks outbound on invalid candidate', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'outbound:other', label: 'outbound_dispatch' },
      meta: {},
      candidate: { kind: 'wrong' },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E3_OUTBOUND_CANDIDATE_INVALID);
  });
});

describe('LocalEthicsGuard E4 revocability', () => {
  it('allows deliverable metadata with well-formed undoToken', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'deliverable:metadata', label: 'x' },
      meta: {},
      candidate: { metadata: { workflowId: 'w', undoToken: 'undo-173-x' } },
    });
    expect(r.verdict).toBe('allow');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E4_DELIVERABLE_PASS_SCREEN);
  });

  it('blocks deliverable metadata missing undoToken', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'deliverable:metadata', label: 'x' },
      meta: {},
      candidate: { metadata: { workflowId: 'w' } },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E4_DELIVERABLE_MISSING_UNDO_TOKEN);
  });

  it('blocks malformed undoToken on deliverable', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'deliverable:metadata', label: 'x' },
      meta: {},
      candidate: { metadata: { undoToken: 'undo-' } },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E4_DELIVERABLE_UNDO_TOKEN_MALFORMED);
  });

  it('allows execution undo with valid token', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'execution:undo', label: 'x' },
      meta: {},
      candidate: { token: 'undo-99-zz' },
    });
    expect(r.verdict).toBe('allow');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E4_UNDO_PASS_SCREEN);
  });

  it('blocks execution undo with invalid candidate shape', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'execution:undo', label: 'x' },
      meta: {},
      candidate: { notToken: 'x' },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E4_UNDO_CANDIDATE_INVALID);
  });

  it('blocks execution undo with malformed token', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'action', skillId: 'execution:undo', label: 'x' },
      meta: {},
      candidate: { token: 'nope' },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E4_UNDO_TOKEN_MALFORMED);
  });
});

describe('LocalEthicsGuard core-ai output rules (E3 + E2 + E5)', () => {
  it('accepts valid clarify output and tags E3+E2 pass-screen', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'output_text', label: 'core_ai_clarify' },
      meta: {},
      candidate: {
        questions: [
          { id: 'q1', text: '何时？', type: 'text' as const },
        ],
        draftMeta: {},
      },
    });
    expect(r.verdict).toBe('allow');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E3_CORE_CLARIFY_PASS);
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E2_CORE_OUTPUT_PASS);
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E5_CORE_OUTPUT_PASS);
  });

  it('blocks clarify with coercive question wording (E2)', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'output_text', label: 'core_ai_clarify' },
      meta: {},
      candidate: {
        questions: [{ id: 'q1', text: '不完成就会删除你的账户', type: 'text' as const }],
        draftMeta: {},
      },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E2_CORE_COERCIVE_LANGUAGE);
  });

  it('blocks clarify when draftMeta missing', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'output_text', label: 'core_ai_clarify' },
      meta: {},
      candidate: { questions: [] },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E3_CORE_CLARIFY_INVALID);
  });

  it('accepts valid plan output', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'plan', label: 'core_ai_plan' },
      meta: {},
      candidate: { tasks: [], milestones: [] },
    });
    expect(r.verdict).toBe('allow');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E3_CORE_PLAN_PASS);
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E2_CORE_OUTPUT_PASS);
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E5_CORE_OUTPUT_PASS);
  });

  it('blocks plan when tasks not array', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'plan', label: 'core_ai_plan' },
      meta: {},
      candidate: { tasks: {}, milestones: [] },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E3_CORE_PLAN_INVALID);
  });

  it('accepts valid variation output', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'plan', label: 'core_ai_variation' },
      meta: {},
      candidate: { variations: [] },
    });
    expect(r.verdict).toBe('allow');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E3_CORE_VARIATION_PASS);
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E2_CORE_OUTPUT_PASS);
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E5_CORE_OUTPUT_PASS);
  });

  it('blocks variation when variations missing', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'plan', label: 'core_ai_variation' },
      meta: {},
      candidate: {},
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E3_CORE_VARIATION_INVALID);
  });

  it('accepts valid keywords output', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'output_text', label: 'core_ai_keywords_brief' },
      meta: {},
      candidate: { keywords: ['a'], brief: 'summary' },
    });
    expect(r.verdict).toBe('allow');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E3_CORE_KEYWORDS_PASS);
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E2_CORE_OUTPUT_PASS);
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E5_CORE_OUTPUT_PASS);
  });

  it('blocks keywords brief with exclusionary wording (E5)', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'output_text', label: 'core_ai_keywords_brief' },
      meta: {},
      candidate: { keywords: ['a'], brief: 'only men should apply' },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E5_CORE_EXCLUSIONARY_LANGUAGE);
  });

  it('blocks keywords when brief empty', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'output_text', label: 'core_ai_keywords_brief' },
      meta: {},
      candidate: { keywords: ['a'], brief: '   ' },
    });
    expect(r.verdict).toBe('block');
    expect(r.rulesTriggered).toContain(ETHICS_RULE_E3_CORE_KEYWORDS_INVALID);
  });

  it('defaults allow for unrelated labels', async () => {
    const r = await guard.checkCandidate({
      subject: { type: 'output_text', label: 'other' },
      meta: {},
      candidate: { foo: 1 },
    });
    expect(r.verdict).toBe('allow');
    expect(r.rulesTriggered).toBeUndefined();
  });
});
