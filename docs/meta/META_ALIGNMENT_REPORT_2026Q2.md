# META_ALIGNMENT_REPORT_2026Q2

> 首份 baseline 独立仓季度 meta 披露（模板 v1 实例）。  
> 模板：[`INTDONE_INTDECK_QUARTERLY_META_DISCLOSURE_TEMPLATE_v1.md`](../INTDONE_INTDECK_QUARTERLY_META_DISCLOSURE_TEMPLATE_v1.md)

---

## 0. 报告元数据

| 字段 | 填写 |
|------|------|
| 报告周期 | 2026-Q2（B4 观察期首开） |
| 主系统仓库 | `xyan8921/Intdone`（闭源；本报告不引用内部 commit） |
| baseline 标签范围 | `v0.1.0`（核心）· 门户迭代至站点 v0.2.0（未单独打 tag） |
| 撰写人 / 维护者 | Intdeck-Baseline 社区维护者 |
| 披露日期 | 2026-05-20 |

---

## 1. 威胁模型

- **白皮书版本**：`INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md`（随 `v0.1.0` 冻结）
- **新增攻击面**（摘要）：
  - [x] 无新增（观察期首版以导出子集为准）
- **废弃/降级攻击面**：
  - [x] 无
- **红队闸门版本**：`REDTEAM_GATE_V0_VERSION=0.1`

---

## 2. Schema / 契约

### 2.1 `UnifiedAuditEventV1`

| 项 | 变化 |
|----|------|
| `schemaVersion` | 无变化（与 `v0.1.0` 导出一致） |
| 字段增删 | 无 |
| 默认值/语义变化 | 无 |

### 2.2 `G0ActionReportV1`

| 项 | 变化 |
|----|------|
| 必填字段 | 无变化 |
| `inputSnapshot` / `outputSnapshot` | 无变化 |

### 2.3 Experience 导出包 / Evidence Pack

| 项 | 变化 |
|----|------|
| `experience.export.json` manifest | 与主仓 Agent CLI 路径一致；baseline 仓本地以 `npm test` + `redteam:v0` 为 CI 等价 |
| `evidence.manifest.json` schemaVersion | 无变更声明 |
| `gates.summary.json` | 主仓 `intdeck:agent gates` 产物；baseline 仓不强制入库 |
| `replay.results.json` | 无变更 |

---

## 3. Capabilities / manifest 契约

- **能力声明文件**：`config/intdeck-agent.default.json`（`networkEgress: deny`，`llm: false`）
- **configSha256 策略**：无变更
- **新增/废弃 capability 键**：无

---

## 4. 红队闸门（pass/fail 摘要）

| 用例类别 | 本季度结果 | 修复/说明 |
|----------|------------|-----------|
| T6 供应链（allowlist） | pass | `redteam:v0` + `config/intdeck-baseline-export.json` |
| stage0 LLM deny | pass | fail-closed |
| outbound confirmation | pass | fail-closed |
| CI `npm ci` → lint → test → redteam:v0 | pass | GitHub Actions |

---

## 5. 依赖与 SBOM（可选）

- **高危 CVE 摘要**：观察期未单独跑 SBOM；`npm audit` 由维护者按需跟进
- **供应链策略变化**：无动态插件市场；`package-lock.json` 锁定 dev 依赖

---

## 6. 不对齐项与跟进（若有）

| ID | 描述 | 计划关闭日期 | 状态 |
|----|------|--------------|------|
| META-001 | 门户站点 v0.2.0 未打独立 semver tag（仅 `main` 部署） | 下一门户 tag 或 `v0.2.0` 核心 minor 前 | open |
| META-002 | 主仓 `intdeck:agent` CLI 未纳入 baseline 仓 `package.json`（文档等价路径已说明） | `v0.2.0` 评估 | open |

---

## 7. 签核

- [x] baseline 维护者确认：本报告已覆盖当季 **已知** 元信息不对齐项（见 §6）。
- [ ] 主系统维护者确认（闭源）：交叉引用至 Intdone 侧 meta（若适用）。

---

## 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-05-20 | 1.0 | B4 观察期首份实例（#10） |
