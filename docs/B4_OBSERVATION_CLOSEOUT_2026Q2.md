# B4 观察期收尾（2026-Q2）

> **仓库**：`xyan8921/Intdeck-Baseline` · **Pin**：[Issue #14](https://github.com/xyan8921/Intdeck-Baseline/issues/14)  
> **日期**：2026-05-20

## 观察期清单（已完成）

| Issue | 主题 |
|-------|------|
| #8 | 独立仓 CI（`package.json` · Vitest 3 · Actions） |
| #9 | 全历史 gitleaks |
| #10 | 首份季度 meta（`docs/meta/META_ALIGNMENT_REPORT_2026Q2.md`） |
| #11 | 门户 docs / i18n / 亮暗 / www 链回 |
| #12 | 投放节奏（`GOVERNANCE.md` §4.1） |
| #13 | contributor 示例 skill |

## 当前版本语义

| 范围 | 版本 |
|------|------|
| 核心冻结（export） | `v0.1.0` |
| 门户站点（`main` 部署） | v0.2.x 世代（未单独打核心 tag） |
| 品牌站 | `apps/intdeck-www` @ Intdone 仓（www.intdeck.com） |

## 定位（写死）

- **Intdeck（意得）Baseline** = 可审计 **治理底盘** 开源快照，非可用 Agent 产品基座。
- **能力演进真源**：Intdone 主仓 `src/core` → **export 投放**；本仓社区 PR **不** 批量回流闭源。

## 下一档（维护者 · Intdone 侧主导）

1. 主仓规划 `v0.2.0` export 范围（是否纳入 `intdeck:agent` CLI 等）。
2. `npm run export:intdeck-baseline` + `scan:baseline-secrets` → 本仓 tag + Release notes。
3. 更新季度 meta（2026-Q3 或随 minor）。

## 入口

- 开源主场：https://www.baseline.intdeck.com  
- 品牌入口：https://www.intdeck.com  
- README L1/L2/L3 + Run gates：`README.md`
