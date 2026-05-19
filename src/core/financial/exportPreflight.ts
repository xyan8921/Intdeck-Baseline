export type ExportPreflightResult =
  | { ok: true; confirm?: { message: string } }
  | { ok: false; error: string };

export type ExportPreflightInput = {
  /** 选择数量（已勾选） */
  selectedCount: number;
  /** 可见数量（当前列表） */
  visibleCount: number;
  /** 是否存在“混合口径风险”（例如端别混合、价值归属混合等） */
  mixedRisk?: boolean;
  /** 风险提示仅在“未筛选”时触发确认（避免用户已筛选仍被打扰） */
  riskConfirmOnlyWhenUnfiltered?: boolean;
  /** 当前是否处于“未筛选”状态（由页面自行定义） */
  isUnfiltered?: boolean;
  /** purpose/scope 等声明字段是否齐全（B 端） */
  declarationsOk?: boolean;
  /** 当 mixedRisk 命中且需要确认时的文案 */
  mixedRiskConfirmMessage?: string;
};

export function exportPreflightCheck(input: ExportPreflightInput): ExportPreflightResult {
  if (input.visibleCount <= 0) {
    return { ok: false, error: '导出失败：当前无可导出的记录。' };
  }
  if (input.selectedCount <= 0) {
    return { ok: false, error: '导出失败：请至少勾选一条记录。' };
  }
  if (input.declarationsOk === false) {
    return { ok: false, error: '导出失败：purpose/scope 不能为空。' };
  }

  const mixed = Boolean(input.mixedRisk);
  const shouldGateByFilter =
    input.riskConfirmOnlyWhenUnfiltered === true ? Boolean(input.isUnfiltered) : true;

  if (mixed && shouldGateByFilter) {
    return {
      ok: true,
      confirm: {
        message:
          input.mixedRiskConfirmMessage ??
          '当前导出包含混合口径数据。建议先筛选后导出。是否继续？',
      },
    };
  }
  return { ok: true };
}

