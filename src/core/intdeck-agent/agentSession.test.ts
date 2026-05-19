import { describe, expect, it } from 'vitest';
import {
  appendSessionTrace,
  closeAgentSession,
  createAgentSession,
  type AgentSessionV1,
} from './agentSession';

const ACTOR = { actorType: 'human' as const, actorId: 'user-1' };

describe('AgentSession — createAgentSession', () => {
  it('返回 schemaVersion=1, status=active, 空 executionTrace', () => {
    const s = createAgentSession(ACTOR);
    expect(s.schemaVersion).toBe(1);
    expect(s.status).toBe('active');
    expect(s.actor).toEqual(ACTOR);
    expect(s.executionTrace).toHaveLength(0);
    expect(s.sessionId).toMatch(/^sess_/);
    expect(s.startedAt).toBeTruthy();
    expect(s.endedAt).toBeUndefined();
  });

  it('接受自定义 sessionId', () => {
    const s = createAgentSession(ACTOR, { sessionId: 'my-session' });
    expect(s.sessionId).toBe('my-session');
  });

  it('接受 manifest 注入', () => {
    const manifest = {
      schemaVersion: 1 as const,
      loadedFrom: 'test',
      configSha256: 'a'.repeat(64),
      capabilities: { llm: false, thirdPartyAPI: false, networkEgress: 'deny' as const },
    };
    const s = createAgentSession(ACTOR, { manifest });
    expect(s.manifest).toEqual(manifest);
  });

  it('未提供 manifest 时字段不存在', () => {
    const s = createAgentSession(ACTOR);
    expect('manifest' in s).toBe(false);
  });
});

describe('AgentSession — appendSessionTrace', () => {
  it('追加一条 trace，sequenceIndex=0', () => {
    const s = createAgentSession(ACTOR);
    const entry = {
      g0ReportId: 'g0_1',
      module: 'governance' as const,
      action: 'test:action',
      outcome: 'succeeded' as const,
      recordedAt: new Date().toISOString(),
      isReplay: false,
    };
    const s2 = appendSessionTrace(s, entry);
    expect(s2.executionTrace).toHaveLength(1);
    expect(s2.executionTrace[0].sequenceIndex).toBe(0);
    expect(s2.executionTrace[0].g0ReportId).toBe('g0_1');
  });

  it('连续追加，sequenceIndex 递增', () => {
    let s = createAgentSession(ACTOR);
    const base = {
      module: 'governance' as const,
      action: 'test:action',
      outcome: 'succeeded' as const,
      recordedAt: new Date().toISOString(),
      isReplay: false,
    };
    s = appendSessionTrace(s, { ...base, g0ReportId: 'g0_a' });
    s = appendSessionTrace(s, { ...base, g0ReportId: 'g0_b' });
    s = appendSessionTrace(s, { ...base, g0ReportId: 'g0_c' });
    expect(s.executionTrace).toHaveLength(3);
    expect(s.executionTrace.map((e) => e.sequenceIndex)).toEqual([0, 1, 2]);
    expect(s.executionTrace.map((e) => e.g0ReportId)).toEqual(['g0_a', 'g0_b', 'g0_c']);
  });

  it('不可变：原始 session 不被修改', () => {
    const original = createAgentSession(ACTOR);
    appendSessionTrace(original, {
      g0ReportId: 'g0_x',
      module: 'governance',
      action: 'a',
      outcome: 'succeeded',
      recordedAt: new Date().toISOString(),
      isReplay: false,
    });
    expect(original.executionTrace).toHaveLength(0);
  });

  it('回放条目携带 replayedFromReportId', () => {
    const s = createAgentSession(ACTOR);
    const s2 = appendSessionTrace(s, {
      g0ReportId: 'g0_new',
      module: 'governance',
      action: 'replay:g0-action-from-experience',
      outcome: 'succeeded',
      recordedAt: new Date().toISOString(),
      isReplay: true,
      replayedFromReportId: 'g0_orig',
    });
    expect(s2.executionTrace[0].isReplay).toBe(true);
    expect(s2.executionTrace[0].replayedFromReportId).toBe('g0_orig');
  });
});

describe('AgentSession — closeAgentSession', () => {
  it('completed 设置 status + endedAt', () => {
    const s = createAgentSession(ACTOR);
    const closed = closeAgentSession(s, 'completed');
    expect(closed.status).toBe('completed');
    expect(closed.endedAt).toBeTruthy();
    expect(closed.startedAt).toBe(s.startedAt);
  });

  it('failed 设置 status=failed', () => {
    const s = createAgentSession(ACTOR);
    const closed = closeAgentSession(s, 'failed');
    expect(closed.status).toBe('failed');
  });

  it('不可变：原始 session status 不变', () => {
    const s = createAgentSession(ACTOR);
    closeAgentSession(s, 'completed');
    expect(s.status).toBe('active');
    expect(s.endedAt).toBeUndefined();
  });

  it('关闭后 executionTrace 保留', () => {
    let s: AgentSessionV1 = createAgentSession(ACTOR);
    s = appendSessionTrace(s, {
      g0ReportId: 'g0_1',
      module: 'governance',
      action: 'act',
      outcome: 'succeeded',
      recordedAt: new Date().toISOString(),
      isReplay: false,
    });
    const closed = closeAgentSession(s, 'completed');
    expect(closed.executionTrace).toHaveLength(1);
  });
});
