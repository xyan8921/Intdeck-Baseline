import type { IntdeckAgentRuntimeManifestV1 } from './experienceTypes';

export type CapabilityDriftSeverity = 'regression' | 'upgrade' | 'neutral';

/** 单个能力字段的漂移记录 */
export interface CapabilityDriftEntry {
  field: string;
  stored: unknown;
  current: unknown;
  severity: CapabilityDriftSeverity;
  /** 人读说明：回放时会发生什么 */
  description: string;
}

function networkEgressSeverity(
  stored: 'deny' | 'allowlist',
  current: 'deny' | 'allowlist'
): CapabilityDriftSeverity {
  if (stored === current) return 'neutral';
  // allowlist → deny：原来能出站，现在不能 → regression
  return stored === 'allowlist' ? 'regression' : 'upgrade';
}

function boolCapSeverity(stored: boolean, current: boolean): CapabilityDriftSeverity {
  if (stored === current) return 'neutral';
  // true → false：原来允许，现在禁止 → regression
  return stored === true ? 'regression' : 'upgrade';
}

/**
 * 比较存档 manifest（经验包写入时）与当前 manifest（回放时）。
 * regression：当前限制比存档更严 → 回放可能被阻止。
 * upgrade：当前限制比存档更宽 → 回放获得额外能力。
 * neutral 字段不进入结果列表。
 */
export function detectCapabilityDrift(
  stored: IntdeckAgentRuntimeManifestV1,
  current: IntdeckAgentRuntimeManifestV1
): CapabilityDriftEntry[] {
  const sc = stored.capabilities;
  const cc = current.capabilities;
  const drifts: CapabilityDriftEntry[] = [];

  const netSev = networkEgressSeverity(sc.networkEgress, cc.networkEgress);
  if (netSev !== 'neutral') {
    drifts.push({
      field: 'networkEgress',
      stored: sc.networkEgress,
      current: cc.networkEgress,
      severity: netSev,
      description:
        netSev === 'regression'
          ? 'networkEgress allowlist→deny：回放出站工具调用将被阻止'
          : 'networkEgress deny→allowlist：出站能力已放行',
    });
  }

  const thirdSev = boolCapSeverity(sc.thirdPartyAPI, cc.thirdPartyAPI);
  if (thirdSev !== 'neutral') {
    drifts.push({
      field: 'thirdPartyAPI',
      stored: sc.thirdPartyAPI,
      current: cc.thirdPartyAPI,
      severity: thirdSev,
      description:
        thirdSev === 'regression'
          ? 'thirdPartyAPI true→false：回放第三方工具调用将被阻止'
          : 'thirdPartyAPI false→true：第三方 API 能力已放行',
    });
  }

  const llmSev = boolCapSeverity(sc.llm, cc.llm);
  if (llmSev !== 'neutral') {
    drifts.push({
      field: 'llm',
      stored: sc.llm,
      current: cc.llm,
      severity: llmSev,
      description:
        llmSev === 'regression'
          ? 'llm true→false：回放 LLM 调用将被阻止'
          : 'llm false→true：LLM 能力已放行',
    });
  }

  return drifts;
}

export function hasCapabilityRegression(drifts: CapabilityDriftEntry[]): boolean {
  return drifts.some((d) => d.severity === 'regression');
}
