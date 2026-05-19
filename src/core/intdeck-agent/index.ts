export { resolveExecutionBackendFromEnv, assertExecutionBackendRunnable } from './executionBackend';
export type { ExecutionBackendV1, ExecutionBackendKind } from './executionBackend';

export { createAgentSession, appendSessionTrace, closeAgentSession } from './agentSession';
export type {
  AgentSessionV1,
  AgentSessionTraceEntry,
  AgentSessionStatus,
} from './agentSession';

export { validateRemoteBackendConfig, createRemoteBackendClient } from './remoteExecutionBackend';
export type {
  RemoteExecutionBackendConfig,
  RemoteBackendResponse,
  RemoteBackendClient,
  RemoteBackendConfigValidation,
} from './remoteExecutionBackend';
