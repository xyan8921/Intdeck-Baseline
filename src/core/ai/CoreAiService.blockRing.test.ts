import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadUnifiedAuditRing } from '../observability/unifiedAuditRingLog';
import { localEthicsGuard } from '../ethics/LocalEthicsGuard';
import { CoreAiService } from './CoreAiService';

const RING_KEY = 'intdone_unified_audit_ring_v1';

vi.mock('../ethics/LocalEthicsGuard', () => ({
  localEthicsGuard: {
    checkCandidate: vi.fn(),
  },
}));

vi.mock('./config/loadAiConfig', () => ({
  getAiConfig: () => ({
    clarifyQuestions: [{ id: 'q1', text: 't', type: 'text' as const }],
    planTasks: [],
    planMilestones: [],
    variations: [],
    keywords: { list: ['k'], brief: 'b' },
  }),
}));

describe('CoreAiService ethics block → unified audit ring', () => {
  const guardMock = localEthicsGuard as unknown as {
    checkCandidate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.removeItem(RING_KEY);
    } catch {
      // ignore
    }
  });

  it('appends ring entry before throw on block', async () => {
    guardMock.checkCandidate.mockResolvedValue({
      verdict: 'block',
      reason: 'test block',
      rulesTriggered: ['ethics.e3.core-ai.clarify-output-invalid'],
    });

    const svc = new CoreAiService();
    await expect(
      svc.clarifyIntent({
        projectId: 'p',
        userId: 'u',
        rawDescription: 'x',
        metaSnapshot: {},
      }),
    ).rejects.toThrow('test block');

    const ring = loadUnifiedAuditRing();
    expect(ring.length).toBe(1);
    const c = ring[0].auditEventV1.correlation as Record<string, unknown>;
    expect(c.channel).toBe('core_ai_enforce_block');
    expect(c.coreAiOperation).toBe('clarify');
    expect(ring[0].auditEventV1.verdict).toBe('block');
  });
});
