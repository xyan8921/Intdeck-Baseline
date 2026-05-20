# example-boundary-reminder（contributor 示例）

> **类型**：`guidance` · 无网络 · 无客户配置 · 可人工复核  
> **用途**：演示 `skills/contributor/` 最小贡献形态（#13）

## 是什么

静态核对清单，帮助贡献者在开 PR 前自检是否触犯 baseline **写死边界**（单向断交、无闭源数据、无出站）。

## 如何使用

1. 阅读 [`checklist.v0.json`](./checklist.v0.json)
2. 逐项勾选；任一项为「否」则先改 PR 范围再提交
3. PR 描述中可粘贴勾选结果（无需运行代码）

## 与红队闸门的关系

不替代 `npm run redteam:v0`。本示例仅覆盖 **流程/边界** 提醒；自动化闸门仍以 `src/core/redteam/` 为准。

## 升格

若需进入 `skills/core/`，由 Maintainers 重写并随 release tag 发布（见 `docs/INTDECK_BASELINE_SKILLS_GOVERNANCE_v0.md`）。
