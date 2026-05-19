# Intdeck baseline 季度 meta 披露模板（v1）

> **版本**：v1.0  
> **最后更新**：2026-05  
> **适用**：闭源主系统（`xyan8921/Intdone`）与 **未来** baseline 独立开源仓之间的 **披露义务**（非管理策略、非代码同步）  
> **关联**：`INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md` §5、`INTDONE_INTDECK_BASELINE_SPLIT_AND_META_SYNC_CHECKLIST_v1.md` §4

---

## 使用说明

1. 每季度（或与 baseline **minor** 版本同步）复制本模板为 `META_ALIGNMENT_REPORT_YYYYQX.md`（示例：`META_ALIGNMENT_REPORT_2026Q2.md`）。
2. 仅填写 **可公开披露** 的元信息；不得包含客户数据、内部工单、密钥或不可公开的 exploit 细节。
3. 主仓与 baseline 仓各保留一份；两边 **版本号/章节引用** 应对齐。

---

## 0. 报告元数据

| 字段 | 填写 |
|------|------|
| 报告周期 | YYYY-QX（例：2026-Q2） |
| 主系统仓库 | `xyan8921/Intdone` @ commit `________` |
| baseline 标签范围 | `v____` → `v____`（若尚未独立仓，填「主仓导出 manifest」commit） |
| 撰写人 / 维护者 | |
| 披露日期 | YYYY-MM-DD |

---

## 1. 威胁模型

- **白皮书版本**：`INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md` @ 章节/修订：________
- **新增攻击面**（摘要，每条 ≤2 句）：
  - [ ] （无） / 填写：________
- **废弃/降级攻击面**：
  - [ ] （无） / 填写：________
- **红队闸门版本**：`REDTEAM_GATE_V0_VERSION=________`

---

## 2. Schema / 契约

### 2.1 `UnifiedAuditEventV1`

| 项 | 变化 |
|----|------|
| `schemaVersion` | 无变化 / `__` → `__` |
| 字段增删 | |
| 默认值/语义变化 | |

### 2.2 `G0ActionReportV1`

| 项 | 变化 |
|----|------|
| 必填字段 | |
| `inputSnapshot` / `outputSnapshot` | |

### 2.3 Experience 导出包 / Evidence Pack

| 项 | 变化 |
|----|------|
| `experience.export.json` manifest | |
| `evidence.manifest.json` schemaVersion | |
| `gates.summary.json` | |
| `replay.results.json`（含 `failureStage` 等） | |

---

## 3. Capabilities / manifest 契约

- **能力声明文件**：`config/intdeck-agent.default.json`（或 baseline 侧等价路径）
- **configSha256 策略**：是否变更默认能力组合？________
- **新增/废弃 capability 键**（仅列键名与一句话语义）：
  - 

---

## 4. 红队闸门（pass/fail 摘要）

> 不含商业内部数据；可引用 CI 日志摘要或 `gates.summary.json` 聚合结果。

| 用例类别 | 本季度结果 | 修复/说明 |
|----------|------------|-----------|
| T6 供应链（allowlist） | pass / fail | |
| （其他 v0 类别） | | |

---

## 5. 依赖与 SBOM（可选）

- **高危 CVE 摘要**（仅包名 + 严重级别 + 建议动作）：
- **供应链策略变化**（如：禁止动态插件市场）：________

---

## 6. 不对齐项与跟进（若有）

| ID | 描述 | 计划关闭日期 | 状态 |
|----|------|--------------|------|
| | | | open / closed |

---

## 7. 签核

- [ ] 主系统维护者确认：本报告已覆盖当季 **所有已知** 元信息不对齐项。
- [ ] baseline 维护者确认（独立仓建立后）：已在 baseline Release notes 交叉引用本报告。

---

## 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-05 | v1.0 | 初版：对齐边界文档 §5 与 checklist §4 |
