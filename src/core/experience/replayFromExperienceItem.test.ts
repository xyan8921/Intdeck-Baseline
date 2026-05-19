import { describe, expect, it } from 'vitest';
import { replayFromExperienceItem, REPLAY_ACTION_TAG, REPLAY_MODULE } from './replayFromExperienceItem';
import { createAgentSession } from '../intdeck-agent/agentSession';
import type { ExperienceItemV1 } from './experienceTypes';

function makeItem(overrides?: Partial<ExperienceItemV1>): ExperienceItemV1 {
  return {
    schemaVersion: 1,
    id: 'exp_test_001',
    createdAt: '2026-01-01T00:00:00.000Z',
    source: {
      kind: 'g0_action_report_v1',
      g0ReportId: 'g0_orig_001',
      recordedAt: '2026-01-01T00:00:00.000Z',
      module: 'ops_console',
      action: 'test:original-action',
      reportSha256: 'b'.repeat(64),
    },
    correlation: { sessionId: 'sess-orig' },
    summary: {
      who: { actorType: 'human', actorId: 'user-1' },
      why: { purpose: 'test purpose', scope: 'test scope' },
      what: { module: 'ops_console', action: 'test:original-action' },
      result: { outcome: 'succeeded' },
      hash: {},
    },
    inputSnapshot: { originalInput: 'data' },
    outputSnapshot: { originalOutput: 'result' },
    ...overrides,
  };
}

function makeManifest(caps?: Partial<{ llm: boolean; thirdPartyAPI: boolean; networkEgress: 'deny' | 'allowlist' }>) {
  return {
    schemaVersion: 1 as const,
    loadedFrom: 'test',
    configSha256: 'a'.repeat(64),
    capabilities: { llm: false, thirdPartyAPI: false, networkEgress: 'deny' as const, ...caps },
  };
}

describe('replayFromExperienceItem — 正常回放路径', () => {
  it('返回 ok=true，module=governance，action=replay:g0-action-from-experience', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem(item);
    expect(res.ok).toBe(true);
    expect(res.report.module).toBe(REPLAY_MODULE);
    expect(res.report.action).toBe(REPLAY_ACTION_TAG);
  });

  it('output 等于存档的 outputSnapshot', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem<{ originalOutput: string }>(item);
    expect(res.output).toEqual({ originalOutput: 'result' });
  });

  it('inputSnapshot 包含 replayOf 审计链路', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem(item);
    const snap = res.report.inputSnapshot as { replayOf: { g0ReportId: string; originalReportSha256: string } };
    expect(snap.replayOf.g0ReportId).toBe('g0_orig_001');
    expect(snap.replayOf.originalReportSha256).toBe('b'.repeat(64));
  });

  it('actor 恢复原始 who.actorType/actorId', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem(item);
    expect(res.report.actor.actorType).toBe('human');
    expect(res.report.actor.actorId).toBe('user-1');
  });

  it('overrideActor 覆盖原始 actor', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem(item, {
      overrideActor: { actorType: 'agent', actorId: 'replay-agent' },
    });
    expect(res.report.actor.actorType).toBe('agent');
    expect(res.report.actor.actorId).toBe('replay-agent');
  });

  it('correlation 从 experience item 继承', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem(item);
    expect(res.report.correlation?.sessionId).toBe('sess-orig');
  });
});

describe('replayFromExperienceItem — 能力漂移', () => {
  it('未提供 manifest → capabilityDrift=undefined，回放成功', async () => {
    const res = await replayFromExperienceItem(makeItem());
    expect(res.capabilityDrift).toBeUndefined();
    expect(res.ok).toBe(true);
  });

  it('stored=current → drifts=[], 回放成功', async () => {
    const m = makeManifest({ networkEgress: 'deny' });
    const res = await replayFromExperienceItem(makeItem(), {
      storedManifest: m,
      currentManifest: m,
    });
    expect(res.capabilityDrift).toHaveLength(0);
    expect(res.ok).toBe(true);
  });

  it('存在 regression 但 blockOnRegression=false → 报告漂移但仍 ok=true', async () => {
    const res = await replayFromExperienceItem(makeItem(), {
      storedManifest: makeManifest({ networkEgress: 'allowlist' }),
      currentManifest: makeManifest({ networkEgress: 'deny' }),
      blockOnRegression: false,
    });
    expect(res.ok).toBe(true);
    expect(res.capabilityDrift?.some((d) => d.severity === 'regression')).toBe(true);
  });

  it('blockOnRegression=true + regression → ok=false，G0 outcome=blocked', async () => {
    const res = await replayFromExperienceItem(makeItem(), {
      storedManifest: makeManifest({ networkEgress: 'allowlist' }),
      currentManifest: makeManifest({ networkEgress: 'deny' }),
      blockOnRegression: true,
    });
    expect(res.ok).toBe(false);
    expect(res.report.summary.result.outcome).toBe('blocked');
    expect(res.capabilityDrift?.some((d) => d.severity === 'regression')).toBe(true);
  });

  it('blockOnRegression=true + 仅 upgrade → ok=true', async () => {
    const res = await replayFromExperienceItem(makeItem(), {
      storedManifest: makeManifest({ networkEgress: 'deny' }),
      currentManifest: makeManifest({ networkEgress: 'allowlist' }),
      blockOnRegression: true,
    });
    expect(res.ok).toBe(true);
    expect(res.capabilityDrift?.every((d) => d.severity === 'upgrade')).toBe(true);
  });
});

describe('replayFromExperienceItem — session 追踪', () => {
  it('未传 session → result.session=undefined', async () => {
    const res = await replayFromExperienceItem(makeItem());
    expect(res.session).toBeUndefined();
  });

  it('传入 session → 追加 trace 条目后返回副本', async () => {
    const session = createAgentSession({ actorType: 'human', actorId: 'user-1' });
    const res = await replayFromExperienceItem(makeItem(), { session });
    expect(res.session).toBeDefined();
    expect(res.session!.executionTrace).toHaveLength(1);
    const entry = res.session!.executionTrace[0];
    expect(entry.isReplay).toBe(true);
    expect(entry.replayedFromReportId).toBe('g0_orig_001');
    expect(entry.sequenceIndex).toBe(0);
  });

  it('session 原始对象不被修改', async () => {
    const session = createAgentSession({ actorType: 'human', actorId: 'user-1' });
    await replayFromExperienceItem(makeItem(), { session });
    expect(session.executionTrace).toHaveLength(0);
  });

  it('多次回放，sequenceIndex 连续递增', async () => {
    let session = createAgentSession({ actorType: 'human', actorId: 'user-1' });

    const r1 = await replayFromExperienceItem(makeItem({ id: 'exp_1' }), { session });
    session = r1.session!;

    const r2 = await replayFromExperienceItem(makeItem({ id: 'exp_2' }), { session });
    session = r2.session!;

    expect(session.executionTrace).toHaveLength(2);
    expect(session.executionTrace[0].sequenceIndex).toBe(0);
    expect(session.executionTrace[1].sequenceIndex).toBe(1);
  });

  it('blockOnRegression 阻断时 session 原样返回（无新条目）', async () => {
    const session = createAgentSession({ actorType: 'human', actorId: 'user-1' });
    const res = await replayFromExperienceItem(makeItem(), {
      storedManifest: makeManifest({ networkEgress: 'allowlist' }),
      currentManifest: makeManifest({ networkEgress: 'deny' }),
      blockOnRegression: true,
      session,
    });
    // 阻断路径直接返回原 session，不追加 trace
    expect(res.session).toBe(session);
  });
});

describe('replayFromExperienceItem — redispatch 模式（Sprint D）', () => {
  it('默认 read-only：output = 存档 outputSnapshot', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem<{ originalOutput: string }>(item);
    expect(res.output).toEqual({ originalOutput: 'result' });
    expect(res.report.action).toBe('replay:g0-action-from-experience');
  });

  it('redispatch + fn：output = fn() 返回值', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem<string>(item, {
      replayMode: 'redispatch',
      fn: async () => 'fresh-result',
    });
    expect(res.ok).toBe(true);
    expect(res.output).toBe('fresh-result');
    expect(res.report.action).toBe('replay:redispatch-from-experience');
  });

  it('redispatch action tag 与 read-only 不同', async () => {
    const item = makeItem();
    const ro = await replayFromExperienceItem(item, { replayMode: 'read-only' });
    const rd = await replayFromExperienceItem(item, {
      replayMode: 'redispatch',
      fn: async () => null,
    });
    expect(ro.report.action).toBe('replay:g0-action-from-experience');
    expect(rd.report.action).toBe('replay:redispatch-from-experience');
  });

  it('redispatch fn 抛错 → ok=false, outcome=failed', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem(item, {
      replayMode: 'redispatch',
      fn: async () => {
        throw new Error('redispatch failed');
      },
    });
    expect(res.ok).toBe(false);
    expect(res.report.summary.result.outcome).toBe('failed');
  });

  it('redispatch 无 fn → 抛错', async () => {
    const item = makeItem();
    await expect(
      replayFromExperienceItem(item, { replayMode: 'redispatch' })
    ).rejects.toThrow(/replayMode.*redispatch.*fn/);
  });

  it('redispatch inputSnapshot 包含 replayMode 字段', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem(item, {
      replayMode: 'redispatch',
      fn: async () => 'x',
    });
    const snap = res.report.inputSnapshot as { replayMode: string };
    expect(snap.replayMode).toBe('redispatch');
  });

  it('read-only inputSnapshot replayMode=read-only', async () => {
    const item = makeItem();
    const res = await replayFromExperienceItem(item);
    const snap = res.report.inputSnapshot as { replayMode: string };
    expect(snap.replayMode).toBe('read-only');
  });
});
