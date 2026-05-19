/**
 * B 端办公集成 — 类型占位（见 INTDONE_OFFICE_INTEGRATION_ARCHITECTURE_v1.md）
 */

export type OfficeCapability =
  | 'identity'
  | 'messaging'
  | 'calendar'
  | 'files'
  | 'approval'
  | 'directory';

/** 未来各厂商 Adapter 需实现的最小接口（当前无真实网络调用） */
export interface OfficeConnector {
  readonly id: string;
  readonly capabilities: ReadonlySet<OfficeCapability>;
}
