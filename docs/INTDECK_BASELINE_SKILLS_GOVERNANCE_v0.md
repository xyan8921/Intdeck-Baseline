# Intdeck Baseline · Skill 目录与贡献治理（v0）

> **版本**：v0 · 2026-05-19  
> **适用**：B4 后 **baseline 独立开源仓**（非 Intdone 商业仓、非 Console）  
> **关联**：`INTDONE_INTDECK_BASELINE_GOVERNANCE_TEMPLATE_v0.md`、`config/intdeck-baseline-export.json`

---

## 1. 目的

- 为社区 **skill 贡献** 预留目录与许可边界，避免与商业 `src/core/skills` 混仓。
- 明确：**贡献者 skill 不得默认并入 Intdone 商业产品**；商业侧与开源侧 **代码断交** 延续。

---

## 2. 目录规划（baseline 开源仓）

```text
skills/
  core/                    ← baseline 维护者发布；随发行 tag；契约稳定
    README.md
  contributor/             ← 社区 PR 唯一入口
    README.md
    .gitkeep
```

**不进入** `config/intdeck-baseline-export.json` 的 `includeDirs`（除非未来单独立项扩大 allowlist）：

- 首版 B4：`skills/` 在开源仓 **空架 + README**，由拆仓后首次 commit 建立。
- 商业主仓 `Intdone Web/src/core/skills/` 仍按现有 Dev/产品需求演进；**不**自动 sync `contributor/`。

---

## 3. 许可与商用边界（模板条文 · 须法务确认）

| 规则 | 说明 |
|------|------|
| **入站** | 贡献至 `skills/contributor/` 须在 PR 中同意仓库 `CONTRIBUTING.md`（建议 MIT + 贡献者声明） |
| **商业 Intdone** | **不得**将 `skills/contributor/**` 之实现代码 merge 进 `xyan8921/Intdone` 闭源路径，除非单独书面授权 |
| **Console** | 不托管 contributor 源码；可选只读 **元数据/registry**（后期） |
| **贡献者** | 保留开源许可下的使用与再分发；**不**授予 Intdone 商业独占 |
| **升格** | 仅 Maintainers 可将成熟 skill **复制/重写** 进 `skills/core/` 并发 release，不构成对 contributor 路径的自动 merge |

---

## 4. 与 Agent / Dev 的关系

| 组件 | 使用的 skill 来源 |
|------|------------------|
| Intdone Dev / `intdeck-agent` | 主仓 `src/core/skills` + 闭源配置 |
| Baseline 社区运行时 | `skills/core` + 用户显式安装的 `contributor`（若未来支持） |
| Intdeck Console | 闭源规则模板；**不**依赖 contributor 树 |

---

## 5. B4 首版动作

- [ ] 开源仓根目录创建 `skills/contributor/.gitkeep` + 两份 README  
- [ ] `GOVERNANCE.md` §5 引用本文  
- [ ] `CONTRIBUTING.md` 增加「Skill 贡献」小节  
- [ ] 主仓 **不** 新增 `skills/contributor` 路径

---

## 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-05-19 | v0 | B4 前规划：目录 + 商用断交原则 |
