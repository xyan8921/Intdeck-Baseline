# GOVERNANCE

> 适用于 **Intdeck-Baseline** 开源仓（`xyan8921/Intdeck-Baseline`）。  
> 不约束意达 Intdone 商业主系统（`xyan8921/Intdone`）内部研发管理。

---

## 1. 范围

本治理仅适用于 **baseline 仓库**，不约束 Intdone 商业主系统的内部研发管理。

---

## 2. 维护者与决策

- baseline 仓库设定维护者（Maintainers），负责合并与发布。
- 重大变更（破坏性契约、审计 schema、红队闸门变更）必须：
  - 记录变更动机与影响面
  - 更新对应文档与测试
  - 在 release notes / meta 披露中说明

---

## 3. 贡献原则（简版）

- 任何高风险能力必须满足：**可阻断、可审计、可解释、可回滚/可补偿**（缺一不可）。
- 对外工具/出站/执行环境的开放遵循：默认保守、逐级放权、fail-closed。

---

## 4. 发布与 meta 披露

- baseline 以 **tag + GitHub Release** 形式发布（semver）
- 每季度至少一次 meta 披露（或随 **minor** 发布前），实例见 [`docs/meta/`](docs/meta/)
- 披露模板：[`docs/INTDONE_INTDECK_QUARTERLY_META_DISCLOSURE_TEMPLATE_v1.md`](docs/INTDONE_INTDECK_QUARTERLY_META_DISCLOSURE_TEMPLATE_v1.md)

### 4.1 投放节奏（主仓 export → 本仓 tag）

与 [`docs/INTDONE_INTDECK_BASELINE_EXPORT_GUIDE_v1.md`](docs/INTDONE_INTDECK_BASELINE_EXPORT_GUIDE_v1.md) 对齐；**无双向 merge**。

1. **意达 Intdone 主仓**（`xyan8921/Intdone`）：`npm run export:intdeck-baseline` + `npm run scan:baseline-secrets`（粗扫）
2. 审阅 `config/intdeck-baseline-export.json` allowlist diff 与 `baseline.manifest.json`
3. 更新 Release notes（威胁面、schema、依赖）与季度 meta（若跨季）
4. **本仓**打 tag（例 `v0.2.0` minor）并 GitHub Release；门户/README 同步版本文案
5. **禁止**将 baseline 社区 PR 实现批量 cherry-pick 回闭源主仓

下一档里程碑：**`v0.2.0`**（核心 minor，日期由维护者定）。

---

## 5. Skill 目录（社区贡献）

- 目录：`skills/core/`（维护者）、`skills/contributor/`（社区 PR）
- 治理全文：[`docs/INTDECK_BASELINE_SKILLS_GOVERNANCE_v0.md`](docs/INTDECK_BASELINE_SKILLS_GOVERNANCE_v0.md)
- **商业 Intdone 不 merge** `skills/contributor/**` 实现代码；升格至 `skills/core/` 须 Maintainers 评审与 release notes
- 示例：[`skills/contributor/example-boundary-reminder/`](skills/contributor/example-boundary-reminder/)

