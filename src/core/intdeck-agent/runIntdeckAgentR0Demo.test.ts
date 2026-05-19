import { describe, expect, it, vi } from 'vitest';
import { EXECUTION_BACKEND_SCHEMA_VERSION } from './executionBackend';
import { runIntdeckAgentR0DemoG0 } from './runIntdeckAgentR0Demo';

describe('runIntdeckAgentR0DemoG0 (R2-a)', () => {
  it('produces G0 report whose inputSnapshot carries executionBackend (same schema local vs docker metadata)', async () => {
    vi.stubGlobal('window', undefined as unknown as Window);

    const argv = ['node', 'intdeck', 'run'];
    const local = await runIntdeckAgentR0DemoG0({
      cwd: process.cwd(),
      argvSnapshot: argv,
      executionBackend: { schemaVersion: EXECUTION_BACKEND_SCHEMA_VERSION, kind: 'local-process' },
    });
    const docker = await runIntdeckAgentR0DemoG0({
      cwd: process.cwd(),
      argvSnapshot: argv,
      executionBackend: { schemaVersion: EXECUTION_BACKEND_SCHEMA_VERSION, kind: 'docker', label: 'test' },
    });

    expect(local.ok).toBe(true);
    expect(docker.ok).toBe(true);

    const snapLocal = local.report.inputSnapshot as Record<string, unknown>;
    const snapDocker = docker.report.inputSnapshot as Record<string, unknown>;

    expect(snapLocal.executionBackend).toEqual({
      schemaVersion: 1,
      kind: 'local-process',
    });
    expect(snapDocker.executionBackend).toEqual({
      schemaVersion: 1,
      kind: 'docker',
      label: 'test',
    });
    expect(snapLocal.argv).toEqual(argv);
    expect(snapDocker.argv).toEqual(argv);
    expect(snapLocal.intdeckAgentRuntime).toBeDefined();
    expect(snapDocker.intdeckAgentRuntime).toBeDefined();
  });
});
