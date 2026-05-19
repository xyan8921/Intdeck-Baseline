import { runG0Action } from '../governance/g0Shell';
import type { G0ActionReportV1 } from '../governance/g0Types';
import { assertExecutionBackendRunnable, resolveExecutionBackendFromEnv, type ExecutionBackendV1 } from './executionBackend';
import { loadIntdeckAgentRuntimeManifest } from './loadIntdeckAgentConfig';

export interface RunIntdeckAgentR0DemoOptions {
  configPath?: string;
  cwd: string;
  /** 默认 `process.argv`；单测可注入固定快照以便稳定对比 */
  argvSnapshot?: string[];
  /** 单测或显式覆盖；默认 `resolveExecutionBackendFromEnv()` */
  executionBackend?: ExecutionBackendV1;
}

/**
 * Intdeck Agent 演示用 G0 动作（R0/R2-a 共用）：同一函数供本地 CLI 与 Docker CMD 调用。
 */
export async function runIntdeckAgentR0DemoG0(options: RunIntdeckAgentR0DemoOptions): Promise<{
  ok: boolean;
  report: G0ActionReportV1;
  output?: { message: string; at: string };
}> {
  const backend = options.executionBackend ?? resolveExecutionBackendFromEnv();
  assertExecutionBackendRunnable(backend);

  const { manifest } = await loadIntdeckAgentRuntimeManifest({
    configPath: options.configPath,
    cwd: options.cwd,
  });

  const argv = options.argvSnapshot ?? (typeof process !== 'undefined' ? process.argv : []);

  return runG0Action({
    module: 'ops_console',
    action: 'intdeck-agent:r0-demo',
    actor: { actorType: 'human', actorId: 'cli_local' },
    purposeScope: { purpose: 'intdeck_agent_r0', scope: 'local-cli' },
    inputSnapshot: {
      argv,
      intdeckAgentRuntime: manifest,
      executionBackend: backend,
    },
    fn: async () => ({ message: 'r0 ok', at: new Date().toISOString() }),
  });
}
