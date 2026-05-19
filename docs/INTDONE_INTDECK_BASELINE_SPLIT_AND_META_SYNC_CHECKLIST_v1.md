# Intdeck baseline：拆仓与后续投放 / 季度 meta 对齐执行清单（v1）

> **适用**：本仓库（Intdone 商业主系统 · 闭源）与 Intdeck baseline（独立开源仓库 · MIT）  
> **目标**：拆仓后保持“边界清晰、无未披露不对齐”，并建立可持续的投放与监督节奏。  
> **关联**：`INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md`、`INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md`、`INTDONE_TECH_PLAN_v1.md` §0.2

---

## 0. 基本原则（写死）

- **两套长期实体**：闭源主系统（含 `/dev/*`） vs 开源 baseline（冻结基线）。
- **双向代码断交**：baseline 的实现代码不回流闭源主系统；闭源主系统不对 baseline 做日常路线图管理。
- **许可**：baseline 使用 MIT；闭源侧按商业策略处理，不因 baseline 改变授权。
- **投放方式**：主系统侧仅投放“成熟、可公开披露”的版本/skill/workflow 与 meta 信息（见 §3）。

---

## 0.1 主仓库持续集成（闭源主系统 · 2026-05）

> 缩小「文档门禁」与「实际 CI」落差；**不替代** baseline 独立仓 §1–§4 的发布前检查。实现见 [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)；**`package-lock.json` 必须与 `package.json` 同步提交**（否则 Actions 上 `npm ci` 会报 `EUSAGE` / Missing esbuild 等），详见 [`CONTRIBUTING.md`](../CONTRIBUTING.md)「CI 与 package-lock」。

- [x] Push/PR（`main` / `master`）：`.github/workflows/ci.yml` 运行 `npm ci`、`npm run intdeck:agent -- gates`、`npm run export:intdeck-baseline -- --dry-run`（`gates` 内含 `lint` / `test` / `redteam:v0`）。
- [ ] baseline 独立仓：仍须单独建立与本清单 §1–§4 一致的发布与密钥扫描流程。

---

## 1. 拆仓前检查（P0）

### 1.1 安全与泄露前置

- [ ] 确认 **任何密钥/Token** 未出现在 baseline 子树与其历史中（按“已泄露”标准处理：发现即轮换/作废）。
- [ ] baseline 仓库只保留 `.env.example`，不保留 `.env`。
- [ ] baseline 导出产物目录（如 `out/`）不得入库。

### 1.2 基线能力与证据链最小集（建议）

- [x] **门禁（主仓）**：`lint` / `test` / `redteam:v0` 经 `npm run intdeck:agent -- gates` 与 CI（`.github/workflows/ci.yml`）可跑通；baseline 独立仓仍须 §1.2 首项在**新仓**复验。
- [x] **威胁模型（主仓）**：`INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md` + `redteam:v0`（含 T6 allowlist）。
- [x] **证据导出（主仓）**：`evidence.manifest.json` + `evidence.summary.md` + `gates.summary.json` + `replay.*`（见 `docs/INTDECK_AGENT_EVIDENCE_PACK_v1.md`）。
- [x] **非技术说明书已就绪**：`docs/INTDECK_DEV_NON_TECHNICAL_HANDBOOK_v1.md`（分仓时可整章复刻）。
- [x] **B3 导出可复现性**：同 commit 两次 `export:intdeck-baseline -- --dry-run` manifest 一致（步骤见 `INTDONE_INTDECK_BASELINE_EXPORT_GUIDE_v1.md` §3.3）。
- [x] **季度 meta 模板**：`docs/INTDONE_INTDECK_QUARTERLY_META_DISCLOSURE_TEMPLATE_v1.md`。
- [x] **baseline 抓取草案**：`docs/INTDECK_BASELINE_FETCH_MANIFEST_DRAFT_v1.md`（验收前可修订；主仓不参与开源侧日常管理）。

---

## 2. 拆仓动作清单（P0）

- [x] 定义 baseline **范围边界**（允许包含的目录与文件清单）— 真源：`config/intdeck-baseline-export.json`；说明见 `INTDONE_INTDECK_BASELINE_EXPORT_GUIDE_v1.md` §2.3。
- [ ] 生成 baseline 仓库的：
  - [x] `README.md`（开源口径）— 主仓模板：`docs/INTDONE_INTDECK_BASELINE_REPO_README_TEMPLATE_v0.md`（拆仓时复制到 baseline 根目录）。
  - [x] `LICENSE`（MIT）— 主仓根 `LICENSE` 可作为 baseline 起点（拆仓时复制并核对 SPDX）。
  - [x] `SECURITY.md`（漏洞报告渠道与响应承诺的最低口径）— 模板：`docs/INTDONE_INTDECK_BASELINE_SECURITY_TEMPLATE_v0.md`。
  - [x] `CONTRIBUTING.md`（开源贡献流程）— 模板：`docs/INTDONE_INTDECK_BASELINE_CONTRIBUTING_TEMPLATE_v0.md`。
  - [x] `GOVERNANCE.md`（最小治理：维护者、决策与发布）— 模板：`docs/INTDONE_INTDECK_BASELINE_GOVERNANCE_TEMPLATE_v0.md`。
- [ ] 建立发布节奏：tag / release notes / 版本号策略（建议 semver）。

---

## 3. 主系统侧对 baseline 的“投放/回馈”清单（P1 · 持续）

> 只投放“可公开披露、成熟、可复核”的内容，避免把商业客户数据/内部实现细节带入开源侧。

- [ ] **版本投放**：按阶段或季度投放 baseline 新版本（tag + release notes）。
- [ ] **skill / workflow 投放**（可选）：将成熟能力以“可复核、可审计”的形式固化为 baseline 可用的 skill/workflow（不含商业侧专有连接器与客户配置）。
- [ ] **文档投放**：威胁模型、schema 变更、红队用例类别更新说明。

---

## 4. 季度 meta 对齐（披露义务，不是管理策略）

> 目标：**不允许存在未披露的不对齐**（安全与互操作性元信息）。

每季度（或与 baseline minor 版本同步）披露一次，最小清单：

- [ ] 威胁模型版本与新增/废弃攻击面摘要（指向白皮书章节）。
- [ ] `G0ActionReportV1` / 导出包 / `UnifiedAuditEventV1` 的 **schema 版本**变化摘要。
- [ ] capabilities / manifest 契约变化摘要（新增字段、语义变化、默认值变化）。
- [ ] 红队闸门：用例类别变化与 pass/fail 摘要（不含商业数据）。
- [ ] 依赖风险摘要（高危 CVE/供应链风险：仅摘要与升级建议）。

---

## 5. 禁止项（必须遵守）

- [ ] baseline 仓库不得包含商业客户数据、内部工单、或任何密钥。
- [ ] baseline 侧 PR/实现代码不得回流闭源主系统仓库（保持断交约束）。
- [ ] 不在 baseline 中引入“默认远程下载执行/动态插件市场”等高供应链风险能力（除非威胁模型与红队门禁升级后再评审）。

---

## 6. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-05 | v1 | 初版：拆仓清单、投放与季度 meta 对齐口径 |
| 2026-05 | v1 | §2：范围真源与 README/SECURITY/CONTRIBUTING/GOVERNANCE 模板落位（独立仓发布节奏仍待建） |

