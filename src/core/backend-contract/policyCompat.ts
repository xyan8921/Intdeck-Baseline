import type { PolicySnapshot } from './types';

export interface PolicyCompatIssue {
  level: 'error' | 'warning';
  message: string;
}

export function normalizePolicySnapshot(
  input: unknown
): { policy: PolicySnapshot | null; issues: PolicyCompatIssue[] } {
  const issues: PolicyCompatIssue[] = [];
  if (!input || typeof input !== 'object') {
    return { policy: null, issues: [{ level: 'error', message: 'policy 不是对象' }] };
  }
  const p = input as Record<string, unknown>;

  const schemaVersion = p.schemaVersion === 1 ? 1 : 1;
  if (p.schemaVersion !== 1) {
    issues.push({ level: 'warning', message: 'schemaVersion 缺省或不匹配，已按 v1 归一化' });
  }

  const version = typeof p.version === 'string' && p.version.trim() ? p.version : 'unknown';
  const publishedAt =
    typeof p.publishedAt === 'string' && p.publishedAt.trim()
      ? p.publishedAt
      : new Date(0).toISOString();
  const flags = typeof p.flags === 'object' && p.flags && !Array.isArray(p.flags) ? (p.flags as Record<string, boolean>) : {};
  const thresholds =
    typeof p.thresholds === 'object' && p.thresholds && !Array.isArray(p.thresholds)
      ? (p.thresholds as Record<string, number>)
      : {};
  const weights =
    typeof p.weights === 'object' && p.weights && !Array.isArray(p.weights)
      ? (p.weights as Record<string, number>)
      : {};

  return {
    policy: {
      schemaVersion,
      version,
      publishedAt,
      flags,
      thresholds,
      weights,
    },
    issues,
  };
}

