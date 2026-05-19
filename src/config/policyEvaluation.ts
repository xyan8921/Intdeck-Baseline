/**
 * 财务导出等策略评估的运行时开关（与产品形态 / 构建模式对齐）。
 */

function parseTriState(value: string | undefined): boolean | undefined {
  if (value == null || value.trim() === '') return undefined;
  const n = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(n)) return true;
  if (['0', 'false', 'no', 'off'].includes(n)) return false;
  return undefined;
}

/**
 * 无本地 PolicySnapshot 时是否拒绝财务导出（fail-closed）。
 *
 * - 环境变量 `VITE_POLICY_REQUIRE_SNAPSHOT`：显式 `true`/`false` 优先。
 * - 未设置时：**生产构建**（`import.meta.env.PROD`）默认 **严格**；开发默认 **宽松**（便于本地未拉策略时仍能走矩阵演练）。
 */
export function shouldRequirePolicySnapshotForFinancialExport(): boolean {
  const fromEnv = parseTriState(import.meta.env.VITE_POLICY_REQUIRE_SNAPSHOT as string | undefined);
  if (fromEnv !== undefined) return fromEnv;
  return import.meta.env.PROD;
}
