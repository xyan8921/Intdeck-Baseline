# GOVERNANCE（baseline 模板）

> 本文件是 **baseline 独立仓库**的 `GOVERNANCE.md` 模板（v0）。  
> 拆仓后请复制/重命名为 baseline 仓库根目录的 `GOVERNANCE.md`。

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

- baseline 以 tag/release 形式发布（建议 semver）
- 每季度至少一次 meta 披露（或随 minor release），内容见 `INTDONE_INTDECK_BASELINE_EXPORT_GUIDE_v1.md` §5

---

## 5. Skill 目录（社区贡献）

- 目录：`skills/core/`（维护者）、`skills/contributor/`（社区 PR）
- 治理全文见主仓 `INTDECK_BASELINE_SKILLS_GOVERNANCE_v0.md`（拆仓时复制到本仓 `docs/` 或链接）
- **商业 Intdone 不 merge** `skills/contributor/**` 实现代码；升格至 `skills/core/` 须 Maintainers 评审与 release notes

