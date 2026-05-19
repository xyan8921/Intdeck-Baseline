# Intdeck baseline（开源冻结基线）

> 本文件是 **baseline 独立仓库**的 `README.md` 模板（v0）。  
> 在拆仓时从主仓库导出后，请将本文件内容复制/重命名为 baseline 仓库根目录的 `README.md`。

---

## 1. 这是什么

**Intdeck baseline** 是 Intdone 主仓库 Dev 端能力谱系中抽取的 **冻结开源基线**：提供“可审计的底盘”（G0 + 统一审计 + 最小威胁基准 + 红队闸门），用于社区自治与公众监督。

它不是完整产品，也不包含 C/B 产品通路或 UI。

---

## 2. 边界与承诺

- **两套实体**：主系统 Dev 端 vs baseline（详见 `INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md`）。
- **代码路径断交**：baseline 与商业主系统不做双向合并/同步。
- **季度 meta 披露**：只对齐安全与契约元信息，不构成管理策略。

---

## 3. 目录结构（baseline）

- `src/core/**`：治理/审计/执行/策略/伦理/经验存储/红队闸门等核心代码
- `docs/`：Intdeck 架构、边界与威胁模型白皮书
- `ETHICS.md`：伦理宪章
- `LICENSE`：许可（baseline 仓库可替换为专用许可）

---

## 4. 如何运行（建议）

> baseline 仓库建议仅提供：测试、lint、与导出/回放工具。

```bash
npm install
npm test
npm run lint
```

---

## 5. 用户向说明书（建议落位）

拆仓后可将主仓 `docs/INTDECK_DEV_NON_TECHNICAL_HANDBOOK_v1.md` 复制到本仓 `docs/`，并替换文内仓库 URL 与维护者联系方式。

## 6. 安全与披露

- 漏洞上报与响应策略：见 `SECURITY.md`  
- 红队闸门（最小集）：见 `src/core/redteam/*` 与 `docs/INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md`

