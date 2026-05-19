# Intdeck 维护者 Workflow

> 与 [SKILL.md](./SKILL.md) 配套。每个任务复制清单并勾选。

---

## A. 计划（编码前 · 必做）

```
- [ ] 明确 Issue 编号与验收项（对照 #14 子项）
- [ ] 列出将改动的路径（预期 ≤5 个文件为佳）
- [ ] 标出伦理/安全触点（密钥、出站、执行环境、allowlist）
- [ ] 选定验证命令（如 npm test / gitleaks / 静态站预览）
- [ ] 向用户用 3–5 句说明计划；有歧义则先问
```

**计划输出模板**（回复用户时可用）：

```markdown
## 计划
- **Issue**：#N — 一句话目标
- **范围**：`path/a`, `path/b`
- **不做**：…
- **验证**：`command`
- **提交策略**：N 个小 commit + 阶段 push
```

---

## B. 实施（小步）

| 步骤 | 动作 |
|------|------|
| B1 | 一次只做一个逻辑单元（如「仅 package.json」→「仅 ci.yml」） |
| B2 | 每单元本地跑通对应验证 |
| B3 | `git add` 精确路径；commit 信息：`type(scope): 动词 + Issue#` |
| B4 | **默认不 push**；用户要求或阶段完成后再 push |

**Commit 粒度示例**（#8 CI）：

1. `chore(ci): add package.json and scripts (#8)`
2. `ci: add GitHub Actions workflow (#8)`
3. `docs: align README with npm commands (#8)`

---

## C. 落盘自检（编码后 · 必做）

```
- [ ] 本地验证命令全部通过（与 CI 一致）
- [ ] 无密钥、token、.gh-account、真实 .env 入库
- [ ] diff 仅含本 Issue 范围；无无关格式化
- [ ] 伦理：无未说明的出站/下载；高风险路径有测试
- [ ] 文档与脚本一致；Issue 验收项可勾选
```

**自检输出模板**：

```markdown
## 自检
- **已跑**：`…` → 通过/失败
- **伦理/安全**：无新增出站 / 已对照 ETHICS §…
- **遗留**：无 / 列出
```

---

## D. 分阶段推送

| 阶段 | 内容 | push 时机 |
|------|------|-----------|
| D0 | 仅本地 commit | 不 push |
| D1 | P0 完成（如 #8+#9） | 用户确认或 CI 绿后 push 分支 |
| D2 | 开 PR → review | `git push -u origin <branch>` |
| D3 | merge 后 | 不在此 workflow 代行 merge，除非用户明确要求 |

**分支建议**：`feat/issue-N-short-name` 或 `chore/issue-8-ci`。

---

## E. 路线图对照（#14）

| 优先级 | Issue | 典型产出 |
|--------|-------|----------|
| P0 | #8 | `package.json`, `.github/workflows/ci.yml` |
| P0 | #9 | gitleaks 报告（脱敏）贴 Issue |
| P1 | #10–#11 | meta 文档、门户 docs 页 |
| P2 | #12–#13 | GOVERNANCE 投放节、contributor 示例 |

完成一项后在 GitHub Issue 评论链路透自检摘要（不含秘密）。
