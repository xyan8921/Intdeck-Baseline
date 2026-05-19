import { describe, expect, it } from 'vitest';
import {
  assertExecutionBackendRunnable,
  EXECUTION_BACKEND_SCHEMA_VERSION,
  resolveExecutionBackendFromEnv,
} from './executionBackend';

describe('executionBackend (R2-a)', () => {
  it('defaults to local-process', () => {
    const b = resolveExecutionBackendFromEnv({});
    expect(b).toEqual({ schemaVersion: EXECUTION_BACKEND_SCHEMA_VERSION, kind: 'local-process' });
  });

  it('accepts docker and optional label', () => {
    const b = resolveExecutionBackendFromEnv({
      INTDECK_AGENT_EXECUTION_BACKEND: 'docker',
      INTDECK_AGENT_EXECUTION_BACKEND_LABEL: 'ci',
    });
    expect(b).toEqual({
      schemaVersion: EXECUTION_BACKEND_SCHEMA_VERSION,
      kind: 'docker',
      label: 'ci',
    });
  });

  it('accepts local synonyms', () => {
    expect(resolveExecutionBackendFromEnv({ INTDECK_AGENT_EXECUTION_BACKEND: 'local' }).kind).toBe(
      'local-process'
    );
    expect(resolveExecutionBackendFromEnv({ INTDECK_AGENT_EXECUTION_BACKEND: 'LOCAL_PROCESS' }).kind).toBe(
      'local-process'
    );
  });

  it('rejects invalid env value', () => {
    expect(() =>
      resolveExecutionBackendFromEnv({ INTDECK_AGENT_EXECUTION_BACKEND: 'k8s' })
    ).toThrow(/INTDECK_AGENT_EXECUTION_BACKEND/);
  });

  it('remote is now runnable (Sprint D)', () => {
    const b = resolveExecutionBackendFromEnv({ INTDECK_AGENT_EXECUTION_BACKEND: 'remote' });
    expect(b.kind).toBe('remote');
    // Sprint D: assertExecutionBackendRunnable no longer throws for remote
    expect(() => assertExecutionBackendRunnable(b)).not.toThrow();
  });
});
