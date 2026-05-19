/**
 * Intdeck ExecutionBackend（R2-a）：执行面抽象，与 G0 / experience 证据 schema 兼容。
 * CLI 与容器内 `npm run intdeck:agent` 共用同一实现路径；差异仅体现在 inputSnapshot.executionBackend。
 */

export const EXECUTION_BACKEND_SCHEMA_VERSION = 1 as const;

export type ExecutionBackendKind = 'local-process' | 'docker' | 'remote';

/** 与 G0 inputSnapshot 一并归档；字段扩展须升 schemaVersion 或新增并列字段 */
export interface ExecutionBackendV1 {
  schemaVersion: typeof EXECUTION_BACKEND_SCHEMA_VERSION;
  kind: ExecutionBackendKind;
  /** 可选：镜像/宿主标签，便于运维区分 */
  label?: string;
}

const ENV_KEY = 'INTDECK_AGENT_EXECUTION_BACKEND';

function parseKind(raw: string | undefined): ExecutionBackendKind | undefined {
  if (!raw) return undefined;
  const t = raw.trim().toLowerCase();
  if (t === 'local-process' || t === 'local_process' || t === 'local') return 'local-process';
  if (t === 'docker') return 'docker';
  if (t === 'remote') return 'remote';
  return undefined;
}

/**
 * 从环境解析执行后端；默认 **local-process**。
 * 非法值抛错，避免静默落到错误审计语义。
 */
export function resolveExecutionBackendFromEnv(env: NodeJS.ProcessEnv = process.env): ExecutionBackendV1 {
  const parsed = parseKind(env[ENV_KEY]);
  if (env[ENV_KEY]?.trim() && parsed === undefined) {
    throw new Error(
      `${ENV_KEY} 须为 local-process | docker | remote（当前: ${JSON.stringify(env[ENV_KEY])}）`
    );
  }
  const kind = parsed ?? 'local-process';
  const label = env.INTDECK_AGENT_EXECUTION_BACKEND_LABEL?.trim() || undefined;
  return { schemaVersion: EXECUTION_BACKEND_SCHEMA_VERSION, kind, label };
}

/**
 * Sprint D：remote 已由 createRemoteBackendClient (HTTP fetch) 实现，断言已移除。
 * 保留函数签名以维持调用方兼容。
 */
export function assertExecutionBackendRunnable(_b: ExecutionBackendV1): void {
  // all kinds are now runnable
}
