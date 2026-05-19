# CONTRIBUTING（baseline 模板）

> 本文件是 **Intdeck baseline 独立仓库**根目录 `CONTRIBUTING.md` 的 v0 模板。  
> 拆仓后请复制到 baseline 仓库根目录并按实际维护者/流程改写。

---

## 范围

- 本仓库为 **开源冻结基线**（MIT），与 Intdone 商业主系统 **无双向代码 merge**（见主仓 `INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md` §4）。
- 贡献应限于 **底盘**（治理、审计 schema、红队闸门、文档）；不引入商业客户数据或内部运营资产。

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

## 关联

- `GOVERNANCE.md`（治理与决策）  
- `SECURITY.md`（漏洞报告）  
- 主仓拆仓清单：`INTDONE_INTDECK_BASELINE_SPLIT_AND_META_SYNC_CHECKLIST_v1.md` §2
