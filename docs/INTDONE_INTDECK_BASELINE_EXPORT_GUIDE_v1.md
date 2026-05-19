# Intdeck baseline 导出与拆仓操作指南（B3）v1

> **版本**：v1.0  
> **最后更新**：2026-05（§2.3 **allowlist 真源 JSON**；与 B2 **§J**、`redteam:v0` T6 对齐）  
> **适用**：在 **Intdone 主仓库**内生成“开源 baseline 冻结子集”，用于后续独立仓库/Release。  
> **关联**：`INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md`、`INTDONE_TECH_PLAN_v1.md` §0.2.2（B3）、`INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md`

---

## 1. 目标（B3）

- 生成一个**可复现**的 baseline 子树目录（同一 commit 输入 → 同一目录输出）。
- 明确 baseline 包含/不包含内容（目录清单 + manifest）。
- 为后续独立仓库建立最小必备文件：`LICENSE`，以及可落位的 `README.md`/`SECURITY.md`/`GOVERNANCE.md` 模板（随导出包一并提供）。
- 产出“季度 meta 披露”模板（不涉及商业侧管理，只做公开披露义务）。

---

## 2. baseline 子树范围（v1 约定）

### 2.1 必须包含（安全与治理最小基座）

- `src/core/**`（治理、审计、执行、策略、伦理、经验存储、红队闸门测试等）
- `ETHICS.md`（伦理宪章）
- `LICENSE`（许可占位；实际 baseline 仓库可换为专用许可）
- `config/intdeck-baseline-export.json`（allowlist 真源，随 baseline 一并导出）
- `docs/INTDONE_INTDECK_*`（Intdeck 架构/边界/威胁模型白皮书等；**前缀以 `config/intdeck-baseline-export.json` 的 `docsBasenamePrefix` 为准**）

### 2.2 明确不包含（避免把“产品通路”与商业资产带入 baseline）

- `src/pages/**`、`src/features/**`、`src/shared/**`（UI 与产品通路）
- `public/**`（主题库、Mock 响应、资源库等产品资产）
- 与具体业务/客户/运营强绑定的模块（后续若出现，默认排除）

> 说明：baseline 是“可审计的底盘”，不是完整产品站点。

### 2.3 allowlist 真源（B2 / B3）

- **配置文件**：仓库根目录 **`config/intdeck-baseline-export.json`**（`schemaVersion`、`includeDirs`、`includeFiles`、`docsBasenamePrefix`）。  
- **消费方**：`scripts/export-intdeck-baseline.mjs`（导出）、`src/core/redteam/redteamGate.v0.test.ts`（**T6** 红队断言）。  
- **变更纪律**：修改 baseline 范围时须同步更新该 JSON、白皮书 `INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md` §3.5 / §4.2，并跑通 **`npm run redteam:v0`** 与 **`npm run export:intdeck-baseline -- --dry-run`**。

---

## 3. 导出脚本

仓库提供脚本：`scripts/export-intdeck-baseline.mjs`（读取 **`config/intdeck-baseline-export.json`**，见 §2.3）

### 3.1 使用方式

```bash
# 1) 预览（不写盘）
npm run export:intdeck-baseline -- --dry-run

# 2) 生成 baseline 子树（写入 out/intdeck-baseline）
npm run export:intdeck-baseline
```

### 3.2 输出结构（固定）

输出目录：`out/intdeck-baseline/`

- `baseline.manifest.json`：导出清单（输入 commit、时间戳、包含路径、文件计数、sha256 摘要）
- `src/core/**`：baseline 核心代码
- `docs/**`：Intdeck 相关文档（按 §2.1）
- `ETHICS.md`、`LICENSE`

### 3.3 可复现性复核（B3 主仓收口）

在同一 **git commit**（工作区干净）下连续执行两次 dry-run，比对 `baseline.manifest.json` 关键字段应一致：

```bash
npm run export:intdeck-baseline -- --dry-run
# 记录 out/intdeck-baseline/baseline.manifest.json 的 fileCount 与 sha256Summary（或整体文件 sha256）

npm run export:intdeck-baseline -- --dry-run
# 再次比对：fileCount、includedPaths 排序后的列表、sha256Summary 应相同
```

**通过标准**：

- 两次 `commitSha` 相同（对应当前 HEAD）
- `fileCount` 相同
- `sha256Summary`（或 manifest 内逐项 hash 聚合）相同
- 若不一致：检查 `includeDirs` / 本地未提交文件 / 时间戳字段是否误入 hash（脚本应仅对文件内容 hash）

抓取清单草案（baseline 侧 Agent）：`docs/INTDECK_BASELINE_FETCH_MANIFEST_DRAFT_v1.md`。

---

## 4. 拆仓（独立仓库 / Release）建议流程

### 4.1 独立仓库（推荐）

- 新建仓库：`intdeck-baseline`（示例名）
- 将 `out/intdeck-baseline/` 作为根目录内容推送
- baseline 仓库根目录补齐 4 个文件（推荐用模板落位）：
  - `README.md`：将 `docs/INTDONE_INTDECK_BASELINE_REPO_README_TEMPLATE_v0.md` 复制/改名落位
  - `SECURITY.md`：将 `docs/INTDONE_INTDECK_BASELINE_SECURITY_TEMPLATE_v0.md` 复制/改名落位
  - `CONTRIBUTING.md`：将 `docs/INTDONE_INTDECK_BASELINE_CONTRIBUTING_TEMPLATE_v0.md` 复制/改名落位
  - `GOVERNANCE.md`：将 `docs/INTDONE_INTDECK_BASELINE_GOVERNANCE_TEMPLATE_v0.md` 复制/改名落位

### 4.2 GitHub Release（备选）

- 在主仓库打 tag
- 上传 `out/intdeck-baseline/` 打包产物为 release asset

---

## 5. 季度 meta 披露模板（v1）

> 目标：**不允许存在未披露的不对齐**（仅限安全与契约元信息，不是管理策略）。

**主仓模板**：`docs/INTDONE_INTDECK_QUARTERLY_META_DISCLOSURE_TEMPLATE_v1.md`（复制后另存为 `META_ALIGNMENT_REPORT_YYYYQX.md`）。

建议文件名：`META_ALIGNMENT_REPORT_YYYYQX.md`

- **版本范围**：baseline tag 从 \(vA\) → \(vB\)
- **威胁模型**：新增/废弃攻击面摘要（指向 `INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md` 的变更）
- **Schema/契约**：
  - `UnifiedAuditEventV1` schemaVersion 变化
  - `G0ActionReportV1` 字段变化
  - Experience 导出包/manifest 变化
- **红队闸门**：
  - 新增用例类别
  - 本季度 pass/fail 摘要与修复说明（不含商业内部细节）
- **依赖与 SBOM（可选）**：
  - 高危依赖摘要与升级策略

---

## 6. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-05 | v1.0 | §2.1 增 `config/intdeck-baseline-export.json`；§2.3 allowlist 真源；§3 / §4.1 与 B2 **§J** 对齐；独立仓 `CONTRIBUTING` 模板条目 |
| 2026-04 | v1.0 | 初版 |
