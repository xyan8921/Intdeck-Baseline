import type { G0ActorContext, G0ActionOutcome, G0ModuleKey } from '../governance/g0Types';
import type { IntdeckAgentRuntimeManifestV1 } from '../experience/experienceTypes';

export type AgentSessionStatus = 'active' | 'completed' | 'failed' | 'replaying';

/** 每条执行记录：对应一次 G0 报告 */
export interface AgentSessionTraceEntry {
  sequenceIndex: number;
  g0ReportId: string;
  module: G0ModuleKey;
  action: string;
  outcome: G0ActionOutcome;
  recordedAt: string;
  isReplay: boolean;
  /** 若 isReplay=true，指向被回放的原始 G0 报告 ID */
  replayedFromReportId?: string;
}

/** Sprint B 最小 AgentSession 合约：跨动作追踪 actor、manifest、执行链路 */
export interface AgentSessionV1 {
  schemaVersion: 1;
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  status: AgentSessionStatus;
  actor: G0ActorContext;
  /** 本次 session 注入的 manifest（可选；回放时与存档 manifest 对比漂移） */
  manifest?: IntdeckAgentRuntimeManifestV1;
  executionTrace: AgentSessionTraceEntry[];
}

export function createAgentSession(
  actor: G0ActorContext,
  options?: { manifest?: IntdeckAgentRuntimeManifestV1; sessionId?: string }
): AgentSessionV1 {
  return {
    schemaVersion: 1,
    sessionId: options?.sessionId ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    startedAt: new Date().toISOString(),
    status: 'active',
    actor,
    ...(options?.manifest ? { manifest: options.manifest } : {}),
    executionTrace: [],
  };
}

/** 不可变：返回带新追踪条目的 session 副本 */
export function appendSessionTrace(
  session: AgentSessionV1,
  entry: Omit<AgentSessionTraceEntry, 'sequenceIndex'>
): AgentSessionV1 {
  return {
    ...session,
    executionTrace: [
      ...session.executionTrace,
      { ...entry, sequenceIndex: session.executionTrace.length },
    ],
  };
}

/** 不可变：关闭 session，标记最终状态与结束时间 */
export function closeAgentSession(
  session: AgentSessionV1,
  status: 'completed' | 'failed'
): AgentSessionV1 {
  return { ...session, status, endedAt: new Date().toISOString() };
}
