# CONTRIBUTING

> **Intdeck（意得）Baseline** 开源仓贡献说明。与 **Intdone（意达）** 商业主系统无双向 merge。

---

## 范围

- 本仓库为 **开源冻结基线**（MIT），与 Intdone 商业主系统 **无双向代码 merge**（见 [`docs/INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md`](docs/INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md) §4）。
- 贡献应限于 **底盘**（治理、审计 schema、红队闸门、文档、门户静态站）；不引入商业客户数据或内部运营资产。

---

## 开发流程（建议）

1. 从默认分支创建功能分支。  
2. 本地运行：`npm ci` → `npm test` → `npm run lint`（若仓库已提供脚本）。  
3. PR 描述中注明：威胁模型相关变更需同步 `INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md` 与红队用例。  
4. 维护者审核后合并；发布打 tag 并附发行说明（schema 版本、已知限制）。

---

## 安全与供应链

- 不在 Issue/PR 中粘贴密钥或客户数据。  
- 依赖升级须可审计；高危 CVE 按 `SECURITY.md` 与季度 meta 披露节奏处理。

---

## Skill 贡献（`skills/contributor/`）

1. 在 `skills/contributor/<your-skill>/` 下提供 **可复核** 产物（README + 静态配置/清单；避免未披露出站）。
2. 参考示例：[`skills/contributor/example-boundary-reminder/`](skills/contributor/example-boundary-reminder/)。
3. PR 须声明：不请求 merge 回 `xyan8921/Intdone`；伦理约束见 [`ETHICS.md`](ETHICS.md) 与 [`docs/INTDECK_BASELINE_SKILLS_GOVERNANCE_v0.md`](docs/INTDECK_BASELINE_SKILLS_GOVERNANCE_v0.md)。
4. 若改动 `src/core` 或红队类别，须跑通 `npm run redteam:v0` 并更新威胁模型相关章节。

## 关联

- [`GOVERNANCE.md`](GOVERNANCE.md)（治理、投放节奏）  
- [`SECURITY.md`](SECURITY.md)（漏洞报告）  
- [`docs/meta/`](docs/meta/)（季度 meta）  
- 门户：[`apps/baseline-site/`](apps/baseline-site/)
