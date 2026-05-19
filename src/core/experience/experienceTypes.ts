import type { UnifiedAuditEventV1 } from '../observability/unifiedAuditSchema';
import type { G0ActionReportV1, G0CorrelationKeys, G0ModuleKey } from '../governance/g0Types';

export const EXPERIENCE_SCHEMA_VERSION = 1 as const;

/** 磁盘上的 Intdeck Agent 能力声明（R1-b · 只读挂载、可审计） */
export interface IntdeckAgentConfigFileV1 {
  schemaVersion: 1;
  label?: string;
  capabilities: {
    llm: boolean;
    thirdPartyAPI: boolean;
    /** deny：默认；allowlist：显式放行名单（名单本体在 R1-c 与网络策略对齐） */
    networkEgress: 'deny' | 'allowlist';
  };
}

/** 写入 experience 导出 manifest 的运行时快照（与配置文件一致 + hash） */
export interface IntdeckAgentRuntimeManifestV1 {
  schemaVersion: 1;
  /** 解析后的绝对路径或仓库内相对标识 */
  loadedFrom: string;
  /** 配置文件原始 UTF-8 字节的 SHA-256（与离线复核一致） */
  configSha256: string;
  label?: string;
  capabilities: IntdeckAgentConfigFileV1['capabilities'];
}

/**
 * Experience Store v0（最小集）：
 * - 仅存“可审计的结构化条目”，并以 G0 报告为唯一可信来源；
 * - Markdown/展示层可后置，先把 schema、证据引用与导出包钉死。
 */
export interface ExperienceItemV1 {
  schemaVersion: typeof EXPERIENCE_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  /** 经验条目的来源：当前 v1 仅支持 G0 报告蒸馏 */
  source: {
    kind: 'g0_action_report_v1';
    g0ReportId: string;
    recordedAt: string;
    module: G0ModuleKey;
    action: string;
    /** 经验写入时对原始报告做 hash，便于离线复核 */
    reportSha256: string;
  };
  correlation?: G0CorrelationKeys;
  /** who/why/what/result/hash：与 G0 摘要层同源，作为检索与审计入口 */
  summary: G0ActionReportV1['summary'];
  /** 与统一 audit envelope 对齐（可为空，但 baseline 下沉默认要求具备） */
  auditEventV1?: UnifiedAuditEventV1;
  /** 简化：先直接引用原始报告快照；后续可改为指针/裁剪/脱敏块 */
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
}

export interface ExperienceExportManifestV1 {
  schemaVersion: 1;
  exportedAt: string;
  itemCount: number;
  /** 便于后续跨仓 meta 对齐：经验包与审计 envelope 的版本对齐 */
  unifiedAuditSchemaVersion?: number;
  experienceSchemaVersion: typeof EXPERIENCE_SCHEMA_VERSION;
  /** Intdeck Agent CLI/容器注入的只读能力声明快照（R1-b） */
  intdeckAgentRuntime?: IntdeckAgentRuntimeManifestV1;
}

export interface ExperienceExportPackageV1 {
  manifest: ExperienceExportManifestV1;
  items: ExperienceItemV1[];
}

