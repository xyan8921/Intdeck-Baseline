# Gitleaks 全历史密钥扫描报告（§1.1）

> **仓库**：`xyan8921/Intdeck-Baseline`  
> **扫描时间**：2026-05-20（UTC+8 维护者本地）  
> **工具**：gitleaks **8.30.1**  
> **范围**：`main` 全历史（含 tag `v0.1.0`、`v0.1.1`、`v0.1.2`）

## 命令（可复验）

```powershell
# 需安装 gitleaks 8.x（如 winget install Gitleaks.Gitleaks）
.\scripts\scan-git-secrets.ps1
```

等价：

```bash
gitleaks detect --source . --log-opts="--all" --redact \
  --report-format json --report-path docs/security/gitleaks-full-history.json
```

## 结果摘要

| 项 | 结果 |
|----|------|
| 扫描 commit 数 | 8 |
| 扫描体量 | ~855 KB |
| **泄露命中** | **0** |
| 跟踪中的 `.env` | **无**（`git log --all -- "*.env"` 为空） |
| 机器可读报告 | `gitleaks-full-history.json`（`[]`，已脱敏） |

## 结论

按「已泄露」标准：**未发现需轮换的密钥/Token**；可继续观察期发布节奏。若后续命中，须轮换 + 历史清理（BFG 等），**不得**带密发版（见 `SECURITY.md`）。

## 说明

- 本扫描 **不替代** 主仓 `scan:baseline-secrets`（导出目录粗扫）；二者互补。
- `node_modules/` 未入库，不在 git 历史内。
- 报告不含密钥明文；详细 JSON 仅记录「无命中」空数组。
