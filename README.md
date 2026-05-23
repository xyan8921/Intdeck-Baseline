# Intdeck Baseline

> **品牌**：英文 **Intdeck** · 中文 **意得**（与产品主品牌 Intdone / **意达** 区分）  
> **开源主场**：https://www.baseline.intdeck.com · **品牌入口**：https://www.intdeck.com  
> **仓库**：https://github.com/xyan8921/Intdeck-Baseline · **路线图**：[Issue #14](https://github.com/xyan8921/Intdeck-Baseline/issues/14)（观察期已收尾 → [`docs/B4_OBSERVATION_CLOSEOUT_2026Q2.md`](docs/B4_OBSERVATION_CLOSEOUT_2026Q2.md)）

门户与 www 同系视觉；页面语言/主题默认跟随系统（顶栏可切换 EN/中文、亮/暗）。

---

## L1 · 是什么

**Intdeck is not trying to build smarter agents. It is trying to build governable intelligence infrastructure.**

**Intdeck（意得）不是在比 Agent 有多聪明，而是在做可治理、可审计的智能基础设施。**

冻结开源治理子集（`src/core` + 文档 + 红队闸门），供社区自治与公众监督；**不是**完整产品、**不是** Console、**不是** 意达 Intdone 产品首页。

**[Run gates →](#l2--quick-start)**

---

## L2 · Quick Start

与 [www.intdeck.com#quickstart](https://www.intdeck.com#quickstart) 相同的四步；本仓 CI 等价命令如下。

```bash
git clone https://github.com/xyan8921/Intdeck-Baseline.git
cd Intdeck-Baseline
npm ci
npm run lint
npm test
npm run redteam:v0
```

**Fail-closed 一行**：`redteam:v0` 在 stage0 禁用 LLM 时拒绝调用；`runOutbound` 未确认时抛出 `confirmation required`。

意达 Intdone 主仓完整 Agent 证据路径：`npm run intdeck:agent -- gates --outDir=out/intdeck-agent-cli`（含 `evidence.summary.md` / `gates.summary.json`）。

**门禁**：PR 与 `main` 推送跑 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)；全历史密钥扫描见 [`.github/workflows/gitleaks.yml`](.github/workflows/gitleaks.yml) 与 [`docs/security/GITLEAKS_AUDIT_2026-05.md`](docs/security/GITLEAKS_AUDIT_2026-05.md)。

---

## 写死边界（摘要）

| # | 中文 | English |
|---|------|---------|
| 1 | Baseline 永久开源（MIT）— 社区在 Intdeck-Baseline 自治；发行以 tag + Release notes 为准。 | Baseline stays open source (MIT) — Community evolves here; releases are tag + Release notes. |
| 2 | 代码单向断交 — 不得 merge 回 Intdone；主仓仅 export 投放；禁止社区实现批量 cherry-pick 回流。 | One-way code boundary — No merge into closed Intdone. Export-only tags. No bulk cherry-pick merge-back. |
| 3 | 非实时同源 — 冻结快照，非 Dev 实时镜像；Console 闭源，无 git 合并。 | Not live-synced — Frozen subset snapshot. Console closed-source, not git-merged. |

| 维度 | Baseline（OSS） | Intdone（闭源） |
|------|-----------------|-----------------|
| Repository | `xyan8921/Intdeck-Baseline` | `xyan8921/Intdone` |
| Code flow | 仅接收主仓 export | 不接收 Baseline 回流 |
| Scope | `src/core`、CLI、威胁文档 | C/B、`/dev`、Console、商业连接器 |
| Public entry | www.baseline.intdeck.com | www.intdone.com · 品牌 www.intdeck.com |
| Alignment | 季度 meta 披露 — 非日常代码 sync | 同左 |

完整中英对照见门户 [#boundary](https://www.baseline.intdeck.com#boundary) 或 www [写死边界](https://www.intdeck.com#boundary)。

---

## L3 · 深度文档

| 文档 | 说明 |
|------|------|
| [ETHICS.md](./ETHICS.md) | 伦理宪章 |
| [SECURITY.md](./SECURITY.md) | 漏洞上报 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献与 Skill |
| [GOVERNANCE.md](./GOVERNANCE.md) | 维护者、发布与 meta |
| [docs/meta/META_ALIGNMENT_REPORT_2026Q2.md](./docs/meta/META_ALIGNMENT_REPORT_2026Q2.md) | 首份季度 meta（2026-Q2） |
| [docs/INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md](./docs/INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md) | 威胁模型 |
| [docs/INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md](./docs/INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md) | 仓库边界 |
| [docs/INTDONE_INTDECK_ARCHITECTURE_AND_TECH_DESIGN_v1.md](./docs/INTDONE_INTDECK_ARCHITECTURE_AND_TECH_DESIGN_v1.md) | 架构 |
| [docs/](./docs/) | 全部 Intdeck 文档 |

移交说明见主仓 `INTDECK_BASELINE_HANDOFF_TO_COMMUNITY_v1.md`（闭源 `docs/`）。

---

## 目录结构

- `src/core/**` — 治理 / 审计 / 红队闸门
- `docs/` — 白皮书、边界、季度 meta
- `apps/baseline-site/` — 门户静态站（Vercel Root Directory；`i18n.js` + `site.js`）
- `skills/core/` · `skills/contributor/` — Skill 目录

> `src/config/`、`src/shared/utils/` 为测试契约 shim，由本仓维护。
