import { runG0Action } from '../governance/g0Shell';
import type { G0ActorContext, G0ActionReportV1 } from '../governance/g0Types';
import { appendSessionTrace } from '../intdeck-agent/agentSession';
import type { AgentSessionV1 } from '../intdeck-agent/agentSession';
import { detectCapabilityDrift, hasCapabilityRegression } from './detectCapabilityDrift';
import type { CapabilityDriftEntry } from './detectCapabilityDrift';
import type { ExperienceItemV1, IntdeckAgentRuntimeManifestV1 } from './experienceTypes';

export const REPLAY_MODULE = 'governance' as const;
export const REPLAY_ACTION_TAG = 'replay:g0-action-from-experience' as const;

export interface ReplayResult<T = unknown> {
  ok: boolean;
  report: G0ActionReportV1;
  output?: T;
  /** Session 副本：若传入 session，追加本次 trace 后返回 */
  session?: AgentSessionV1;
  /** 能力漂移列表（仅在同时提供 storedManifest + currentManifest 时存在） */
  capabilityDrift?: CapabilityDriftEntry[];
}

export interface ReplayOptions {
  /** 经验包写入时的 manifest（用于漂移对比） */
  storedManifest?: IntdeckAgentRuntimeManifestV1;
  /** 当前运行时 manifest（用于漂移对比） */
  currentManifest?: IntdeckAgentRuntimeManifestV1;
  /** 覆盖原始 actor（默认恢复原始 who.actorType/actorId） */
  overrideActor?: G0ActorContext;
  /** 传入后本次 trace 将追加到副本并在结果中返回 */
  session?: AgentSessionV1;
  /**
   * true：检测到 regression 时在 G0 壳内抛 G0_BLOCK，不执行 fn。
   * false（默认）：仅上报漂移，不阻断回放。
   */
  blockOnRegression?: boolean;
  /**
   * Sprint D：
   * 'read-only'（默认）：fn = 返回存档 outputSnapshot（无副作用，纯审计回放）。
   * 'redispatch'：fn = 重新执行原始动作；需同时提供 `fn` 参数。
   */
  replayMode?: 'read-only' | 'redispatch';
  /**
   * replayMode='redispatch' 时必填：重新执行原始动作的函数。
   * 调用方负责幂等性；G0 壳保证审计落地。
   */
  fn?: () => Promise<unknown>;
}

/**
 * 从单条 ExperienceItem 回放：
 *   1. 可选：检测 storedManifest vs currentManifest 的能力漂移
 *   2. 可选：若 blockOnRegression=true 且存在 regression，G0_BLOCK 阻断
 *   3. 通过 G0 壳执行回放（fn = 返回存档 outputSnapshot）
 *   4. 可选：追加 session 执行链路
 *
 * Sprint B：只读回放（重新材化存档输出，不重新执行原始副作用）。
 * 完整重执行（re-dispatch 原始 fn）留待 Sprint C。
 */
export async function replayFromExperienceItem<T = unknown>(
  item: ExperienceItemV1,
  options?: ReplayOptions
): Promise<ReplayResult<T>> {
  // ── Capability drift detection ────────────────────────────────────────────
  let capabilityDrift: CapabilityDriftEntry[] | undefined;
  if (options?.storedManifest && options?.currentManifest) {
    capabilityDrift = detectCapabilityDrift(options.storedManifest, options.currentManifest);
  }

  const actor: G0ActorContext = options?.overrideActor ?? {
    actorType: item.summary.who.actorType,
    actorId: item.summary.who.actorId,
  };

  const replayInputSnapshot = {
    replayOf: {
      experienceItemId: item.id,
      g0ReportId: item.source.g0ReportId,
      originalReportSha256: item.source.reportSha256,
      originalModule: item.source.module,
      originalAction: item.source.action,
    },
    originalInputSnapshot: item.inputSnapshot,
  };

  // ── Pre-flight block on regression ───────────────────────────────────────
  if (options?.blockOnRegression && capabilityDrift && hasCapabilityRegression(capabilityDrift)) {
    const regressionFields = capabilityDrift
      .filter((d) => d.severity === 'regression')
      .map((d) => d.field)
      .join(', ');

    const res = await runG0Action<T>({
      module: REPLAY_MODULE,
      action: REPLAY_ACTION_TAG,
      actor,
      purposeScope: {
        purpose: item.summary.why.purpose,
        scope: item.summary.why.scope,
      },
      correlation: item.correlation,
      inputSnapshot: replayInputSnapshot,
      fn: async () => {
        throw new Error(
          `G0_BLOCK: capability regression detected — replay blocked. Fields: ${regressionFields}`
        );
      },
    });
    return { ok: false, report: res.report, capabilityDrift, session: options?.session };
  }

  // ── Execute replay through G0 shell ──────────────────────────────────────
  // read-only（默认）：返回存档 outputSnapshot，无副作用。
  // redispatch：调用 options.fn() 重新执行原始动作（调用方负责幂等性）。
  const replayMode = options?.replayMode ?? 'read-only';
  if (replayMode === 'redispatch' && !options?.fn) {
    throw new Error(
      'replayFromExperienceItem: replayMode="redispatch" 时必须提供 options.fn'
    );
  }

  const replayFn: () => Promise<T> =
    replayMode === 'redispatch' ? (options!.fn! as () => Promise<T>) : async () => item.outputSnapshot as T;

  const res = await runG0Action<T>({
    module: REPLAY_MODULE,
    action: replayMode === 'redispatch' ? 'replay:redispatch-from-experience' : REPLAY_ACTION_TAG,
    actor,
    purposeScope: {
      purpose: item.summary.why.purpose,
      scope: item.summary.why.scope,
    },
    correlation: item.correlation,
    inputSnapshot: { ...replayInputSnapshot, replayMode },
    fn: replayFn,
  });

  // ── Session trace ─────────────────────────────────────────────────────────
  let updatedSession = options?.session;
  if (updatedSession) {
    updatedSession = appendSessionTrace(updatedSession, {
      g0ReportId: res.report.id,
      module: REPLAY_MODULE,
      action: REPLAY_ACTION_TAG,
      outcome: res.report.summary.result.outcome,
      recordedAt: res.report.recordedAt,
      isReplay: true,
      replayedFromReportId: item.source.g0ReportId,
    });
  }

  return {
    ok: res.ok,
    report: res.report,
    output: res.output,
    session: updatedSession,
    capabilityDrift,
  };
}
