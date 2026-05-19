import { createBackendContractClient } from './client';
import type { PolicyCurrentRequest, PolicySnapshot } from './types';
import { normalizePolicySnapshot } from './policyCompat';

const STORAGE_KEY = 'intdone_policy_snapshot_store';
const MAX_HISTORY = 20;
let memoryState = '';

export interface PolicyStoreState {
  current: PolicySnapshot | null;
  history: PolicySnapshot[];
  updatedAt: string;
}

function readState(): PolicyStoreState {
  try {
    const raw = getStorageItem(STORAGE_KEY);
    if (!raw) {
      return { current: null, history: [], updatedAt: new Date(0).toISOString() };
    }
    const parsed = JSON.parse(raw) as PolicyStoreState;
    if (!parsed || typeof parsed !== 'object') {
      return { current: null, history: [], updatedAt: new Date(0).toISOString() };
    }
    return {
      current: parsed.current ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return { current: null, history: [], updatedAt: new Date(0).toISOString() };
  }
}

function writeState(state: PolicyStoreState): void {
  setStorageItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadPolicyStoreState(): PolicyStoreState {
  return readState();
}

export async function refreshPolicyFromStub(req: PolicyCurrentRequest): Promise<PolicySnapshot> {
  const client = createBackendContractClient();
  const res = await client.getCurrentPolicy(req);
  if (!res.ok) {
    throw new Error(res.error.message);
  }
  const normalized = normalizePolicySnapshot(res.data.policy);
  if (!normalized.policy) {
    throw new Error('Policy 归一化失败');
  }
  const prev = readState();
  const nextCurrent = normalized.policy;
  const nextHistory = prev.current
    ? [prev.current, ...prev.history].slice(0, MAX_HISTORY)
    : prev.history.slice(0, MAX_HISTORY);
  const next: PolicyStoreState = {
    current: nextCurrent,
    history: nextHistory,
    updatedAt: new Date().toISOString(),
  };
  writeState(next);
  return nextCurrent;
}

export function publishLocalPolicyDraft(patch: {
  flags?: Record<string, boolean>;
  thresholds?: Record<string, number>;
  weights?: Record<string, number>;
}): PolicySnapshot {
  const prev = readState();
  const base: PolicySnapshot =
    prev.current ??
    ({
      schemaVersion: 1,
      version: 'local-initial',
      publishedAt: new Date().toISOString(),
      flags: {},
      thresholds: {},
      weights: {},
    } as PolicySnapshot);

  const next: PolicySnapshot = {
    schemaVersion: 1,
    version: `local-${Date.now()}`,
    publishedAt: new Date().toISOString(),
    flags: { ...base.flags, ...(patch.flags ?? {}) },
    thresholds: { ...base.thresholds, ...(patch.thresholds ?? {}) },
    weights: { ...base.weights, ...(patch.weights ?? {}) },
  };

  const state: PolicyStoreState = {
    current: next,
    history: [base, ...prev.history].slice(0, MAX_HISTORY),
    updatedAt: new Date().toISOString(),
  };
  writeState(state);
  return next;
}

export function rollbackLocalPolicy(): PolicySnapshot | null {
  const prev = readState();
  const [target, ...rest] = prev.history;
  if (!target) return prev.current;
  writeState({
    current: target,
    history: rest,
    updatedAt: new Date().toISOString(),
  });
  return target;
}

function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(key);
  }
  return memoryState || null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, value);
    return;
  }
  if (key === STORAGE_KEY) {
    memoryState = value;
  }
}

