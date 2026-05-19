# Intdeck baseline 与仓库边界（实体划分 · 拆仓 · meta 对齐）v1

> **版本**：v1.0  
> **最后更新**：2026-05（§6 表 **B2** 行与 §0.2.4 **§J** 对齐；`config/intdeck-baseline-export.json` 锚点）  
> **读者**：工程 / 安全 / 产品与开源运营（拆仓前后均适用）  
> **关联**：`INTDONE_INTDECK_ARCHITECTURE_AND_TECH_DESIGN_v1.md` §1.1.1、`INTDONE_TECH_PLAN_v1.md` §0.2.1–0.2.2、`INTDONE_DEV_ENGINEERING_ADOPTION_NOTES_v1.md`、`INTDONE_INTDECK_EXPERIENCE_STORAGE_AND_THREAT_MODEL_v1.md`、`INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md`、`README.md`

---

## 1. 目的

把 **「Dev 端」**、**「开源 Intdeck baseline」** 与 **「商业 Intdone 主系统」** 在文档与工程上的关系说清，避免：

- 误认为存在 **三套**「Intdeck」并行管理；
- 拆仓后出现 **未披露的** 安全/契约不对齐；
- 社区贡献与商业代码之间的 **归属与商用** 争议。

---

## 2. 全盘记忆点（仓库内关键锚点）

| 主题 | 落点 | 说明 |
|------|------|------|
| 内部称谓 vs 对外名 | `src/config/devWorkspace.ts` | 路由恒为 `/dev/*`；内部默认 **Dev 端**；Landing 对外展示 **Intdeck（dev端）**。 |
| C/B/Dev 发布边界 | `docs/INTDONE_TECH_PLAN_v1.md` §0.2、§0.2.1 | C/B 为产品通路；`/dev/*` 不走 C/B 门禁；禁止 C/B 主流程依赖 Dev。 |
| 治理与 G0 | `src/core/governance/`、`g0Shell.ts`、`g0ReportStore.ts` | `runG0Action`、G0 报告、出站/LLM gate 包壳位点。 |
| 统一审计 | `unifiedAuditSchema.ts`、`unifiedAuditRingLog.ts` | 与 Experience Store 审计锁、导出包 correlation 对齐。 |
| Dev 可观测 | `/dev/logs`、`/dev/finance`、`/dev/policy-replay` 等 | 试验与可观测；生产构建可关 Dev（`VITE_ENABLE_DEV_WORKSPACE`）。 |
| 当前贡献模型 | `CONTRIBUTING.md` | **本仓库**现阶段为闭源私有；baseline 拆仓后的社区治理需 **另文**（见 §7）。 |

---

## 3. 只承认两套长期实体（核心边界）

1. **主系统内的 Dev 端（`/dev/*`）**  
   - 位于 **Intdone 商业主仓库**内持续演进。  
   - 与 C/B 共享 `core/` 等架构成长通路；**发布通路**与上线验收仍以 C/B 为准。

2. **开源 Intdeck baseline（未来：独立仓库或版本化发布包）**  
   - 从 Dev 端能力谱系中抽取的 **冻结基线**（子集/导出），供社区自治与公众监督。  
   - **不承诺**与主系统 Dev 端 **实时同源**；以 **tag/发行说明** 为准。

**不是第三套**：对外商品名「Intdeck」与工程内「Dev 端」是 **同一能力谱系** 的不同称谓与发布形态，不单独再拆「Core/Community」为第三套产品线。

---

## 4. 拆仓后的强约束（代码层）

- **双向代码断交**：baseline 仓库与商业主系统仓库 **不合并、不同步、不互为 git remote 的常规双向合并**。  
- **商业侧**：可吸收公开文档中的 **架构、契约、治理与威胁模型方法论**；**不将社区贡献的原始实现代码** 直接并入商业仓库（避免归属纠葛；若未来政策变更须单独立法/贡献协议评审）。  
- **baseline 侧**：社区自治；安全与契约以 **公开披露** 与 **发行物** 为准。

---

## 5. 季度 meta 对齐（披露义务，非管理策略）

**目标**：**不允许存在未披露的不对齐**（特指安全与互操作性元信息）。

建议每季度至少披露一次（或与 baseline **semver minor** 同步），范围限定为：

- 威胁模型版本与新增/废弃攻击面摘要；
- `UnifiedAuditEventV1` / 导出包 / G0 报告相关 **schema 版本**变更；
- 插件 manifest、**capabilities** 契约变更；
- 红队闸门 **用例类别**与 **pass/fail 摘要**（不含商业客户数据）；
- 依赖与 SBOM **高危项摘要**。

**明确不属于 meta 对齐**：社区路线图指挥、贡献者 KPI、商业侧功能排期。

---

## 6. 后续开发计划（映射到主仓库里程碑）

下列工作在 **当前 Intdone 主仓库** 内优先落地（Dev 端 + `core/`），拆仓时再将 **冻结子集** 导出为 baseline；顺序与 `INTDONE_TECH_PLAN_v1.md` **§0.2.2** 一致。

| 阶段 | 内容 | 主要文档 / 代码锚点 |
|------|------|---------------------|
| **B0** | 边界与模板定稿（本文 + TECH_PLAN + 架构交叉引用） | 本文、`INTDONE_INTDECK_ARCHITECTURE_AND_TECH_DESIGN_v1.md` |
| **B1** | Experience Store v0：本地存储 + schema + G0/审计锁 + 导出包 | `g0Shell.ts`、`g0ReportStore.ts`、`unifiedAudit*`；备忘见 `INTDONE_INTDECK_EXPERIENCE_STORAGE_AND_THREAT_MODEL_v1.md` |
| **B2** | 威胁模型白皮书 v0 + 红队最小集（**✅ 已完成**，见 `INTDONE_TECH_PLAN_v1.md` **§0.2.4 §J**） | `INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md`（§3.5 T6、§4.2）；`redteamGate.v0.test.ts`；`config/intdeck-baseline-export.json`；架构 §6、`EXPERIENCE_STORAGE` §3、Phase D5 |
| **B3** | 拆仓准备：目录清单、导出脚本、LICENSE/SECURITY/CONTRIBUTING/GOVERNANCE 模板 | `INTDONE_INTDECK_BASELINE_EXPORT_GUIDE_v1.md`、`config/intdeck-baseline-export.json`、模板 `docs/INTDONE_INTDECK_BASELINE_*_TEMPLATE_v0.md`；**独立仓首发与发布节奏**仍待 |
| **B4** | baseline 独立仓库首版（若发布节奏允许） | 依赖 B0–B3 |

> 补充：若目标是“本人可部署使用的 Intdeck Agent”，需要在 Dev 端同时推进 **Runtime/执行闭环**（先 CLI→再 Docker）。该路线与 baseline 拆仓不冲突，但关注点不同；里程碑见 `INTDONE_TECH_PLAN_v1.md` §0.2.3（R0–R2），架构锚点见 `INTDONE_INTDECK_ARCHITECTURE_AND_TECH_DESIGN_v1.md` §3.3。

---

## 7. 与 `CONTRIBUTING.md` 的关系

- **当前**：`CONTRIBUTING.md` 描述 **本仓库** 闭源团队贡献流程。  
- **拆仓后**：开源 baseline 仓库应配备 **独立的** `CONTRIBUTING.md`（模板：`docs/INTDONE_INTDECK_BASELINE_CONTRIBUTING_TEMPLATE_v0.md`）/ `GOVERNANCE.md` / `SECURITY.md`；本文 §3–§5 为 **跨仓原则**，细则以各仓文档为准。

---

## 8. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-05 | v1.0 | §6 表 B2/B3 与 B2 **§J**、`config/intdeck-baseline-export.json` 对齐；§7 baseline CONTRIBUTING 模板路径 |
| 2026-04 | v1.0 | 初稿：两套实体、拆仓约束、季度 meta、锚点表与 B0–B4 计划 |
