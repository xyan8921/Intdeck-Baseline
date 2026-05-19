# Intdeck 架构与技术设计 v1.0

> **版本**：v1.0（与 Intdone 主仓库 **v1.0 / 1.0.x** 同期对齐的**架构基线文档**，不单独绑产品 semver）  
> **最后更新**：2026-04  
> **读者**：工程 / 安全与合规 / 产品（Dev 与 C/B 协同边界）  
> **关联**：`ETHICS.md`、`INTDONE_ETHICS_RULE_ALIGNMENT_v1.md`、`INTDONE_TECH_PLAN_v1.md` §0.2–0.2.2、§1.3.2、`INTDONE_DEV_ENGINEERING_ADOPTION_NOTES_v1.md`、`INTDONE_INTDECK_EXPERIENCE_STORAGE_AND_THREAT_MODEL_v1.md`（经验存储 / 插件边界 / 威胁模型整合备忘）、`INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md`（baseline 与拆仓边界）

---

## 1. 定位与设计公理

### 1.1 Intdone 与 Intdeck

| 名称 | 工程内称谓 | 路由 | 职责 |
|------|------------|------|------|
| **Intdone** | 主系统 | `/c/*`、`/b/*` | 面向用户的产品通路：**低自由度、强确定、傻瓜式**体验；发布门禁与验收以 C/B 为准。 |
| **Intdeck** | **Dev 端**（内部固定称谓）；对外/开源基线可用 **Intdeck** | `/dev/*` | **受监管自治工作台（Regulated Autonomy Workbench）**：最高自由度的模型接入、编排试验、连接器、观测导出、策略回放；**默认不进入 C/B 必达门禁**。 |

#### 1.1.1 「Dev 端」与「开源 Intdeck baseline」的实体边界（避免三套 Intdeck 的误解）

本文档在工程语义上只承认两套长期实体：

- **主系统 Dev 端（`/dev/*`）**：Intdone 仓库内持续演进的受监管自治工作区；其底层 `core/` 能力与 C/B 可共享（见公理 1.2），但**发布通路**与验收仍以 C/B 为准。
- **开源 Intdeck baseline（独立仓库/发布包）**：从主系统 Dev 端抽取的**冻结开源基线**（或按版本导出的子集），用于社区自治与公众监督；其边界以“生存级硬闸 + 可审计证据链 + 最小威胁基准”为主，**不承诺**与主系统 Dev 端保持实时同源。

拆仓后的强约束（用于消除代码归属/商用纠葛，而非管理策略）：

- **代码路径断开**：开源 baseline 与商业主系统**不做双向代码交互**（不合并、不同步、不反向依赖）。商业侧可吸收公开披露的**架构、契约与治理方法论**，但不直接照搬社区贡献的原始实现代码进入商业仓库。
- **季度 meta 对齐（披露义务）**：允许每季度做一次“元信息对齐”，目标是**不允许存在未披露的不对齐**，对齐范围仅限：威胁模型版本/攻击面、审计与导出 schema 版本、插件/capabilities 契约、红队闸门用例类别与结果摘要、依赖与 SBOM 风险摘要；不构成对社区路线与交付的管理。

### 1.2 核心公理（必须写进评审与 CI 心态）

1. **伦理与安全元序**高于功能交付（与 `ETHICS.md`、`INTDONE_DEV_ENGINEERING_ADOPTION_NOTES_v1.md` §0 一致）。  
2. **隔离的是「发布通路」，不是「架构成长通路」**  
   - **发布通路**：C/B 是否可见 `/dev`、是否纳入上线冒烟、是否允许用户依赖 Dev 完成主流程 —— **严格隔离**。  
   - **架构成长通路**：`core/` 能力（闸门、审计、工作流、契约）可被 Dev 先行验证，再**收敛封装**进 C/B —— ** intentionally 共享**。  
3. **凡高风险自由度，必须「可阻断、可审计、可解释、可回滚/可补偿」** —— 缺一不可则不进入 C/B。

### 1.3 与「OpenClaw / Hermes 类」范式关系

- **形态上**：Intdeck 目标包含高自由度 **skill + workflow + 多模型 + 工具/连接器**（与行业范式对齐）。  
- **根本上**：外部范式多强调**运行时与编排**；Intdone 栈必须再叠一层 **治理面（Governance Plane）** —— 使「能跑」不等于「允许跑」。可参考业内的多后端执行与网关思路（如 [Hermes Agent](https://github.com/NousResearch/hermes-agent) 的 gateway、toolsets、多执行环境等），但 **Hermes 或其同类不得替代** 本地 `EthicsGuard`、稳定 `ruleId`、`evaluatePolicy` 语义与 **统一审计 envelope**。

---

## 2. 五层工程视图（全景）

将产品叙事压成可实现的五层；每层在 Intdeck 先行，成熟后经封装下沉 C/B。

| 层次 | Intdeck 内职责（工程语言） | 向 C/B 转化的标准 |
|------|---------------------------|------------------|
| **体验层（Presentation）** | 生成式 UI 协议、任务态展示、审批/确认卡片、观测导出入口 | 仅暴露**固定、受表约束**的 UI；复杂态由协议驱动组件渲染，且默认只读或强确认 |
| **编排层（Orchestration）** | 多角色/多步骤编排图、FinOps 预算、仲裁规则（可审计理由码） | 编排**模板化**、角色收敛、自治等级降级 |
| **数据层（Data）** | 记忆与知识治理、（可选）黄金链路提取与脱敏、合成/微调数据管线**仅在被授权域** | 默认最小留存；退出/导出/删除路径清晰 |
| **治理层（Governance）** | Ethics + Policy + Shield + 审计证据链 + **自动化红队（Dev 闸）** | C/B 侧仅暴露治理**结果**（允许/拒绝/原因码），不暴露 Dev 试验细节 |
| **基建层（Runtime）** | 端云协同路由、异构算力调度意向、执行环境可插拔（本地/容器/远端等）**在沙箱契约下** | C/B 默认走**最窄能力集**与高可用路径 |

---

## 2.1 业务模块化（Intdeck v1.0 的固定模块）与强制治理模块（G0）

Intdeck 的原始出发点是“自用 + 可扩展的受监管自治”。因此 v1.0 在业务面明确收敛为两个固定模块（便于长期运营），并将第 3 点（合法/合规/可观测/可审计/可回退/可导出报告）提升为**强制治理模块（G0）**，贯穿全链路。

### 2.1.1 两个固定业务模块

#### M1 · 经营监控与对账（Ops Console）

目标：接入自研系统，覆盖后台观测（浏览量/在线/转化）、现金流、留言/私信、投诉工单、合作方对接等“经营态”。

- **能力边界**：以“只读观测 + 受控动作（建单/同步/回复）+ 对账归集”为主；任何对外写入与资金相关动作需升级权限与确认闸（见 §7）。
- **典型工作流（示例）**：数据拉取 → 归集对账 → 留言归档/回复 → 投诉建单与状态同步 → 合作方节点同步 → 经营日报/周报与审计报告导出 → 异常告警 → 单步回退（受限域内）。

#### M2 · 内容量产与运营（Growth Factory）

目标：多项目运营闭环：热点搜集 → 写稿/改写/洗稿 → 配图/视频 → 多平台发布与撤回 → 流量统计 → 留言回复 → 合作意向接收与分级。

- **能力边界**：默认“内容可追溯、可撤稿、可回溯版本”；对外发布为高风险动作，必须经过治理模块的确认与审计（见 G0）。
- **对象模型建议（工程语义）**：`Topic`（热点/选题）、`Draft`（稿件版本链）、`Asset`（素材）、`Distribution`（分发与指标）。回退、审计、报告均以对象为单位归档。

### 2.1.2 G0 · 强制治理模块（Governance-First）

G0 是 Intdeck 的“护栏与证据链总线”，要求：**所有 Skill / Workflow 都必须经由 G0 执行壳运行**，否则视为“不合规能力”，不得进入 C/B 下沉路径。

G0 v1.0 的最小硬要求：

- **可阻断**：Pre-LLM / Post-LLM / Pre-Tool 三环拦截（见 §4），以及策略门禁（见 §3.1）。
- **可审计**：统一证据原子 `UnifiedAuditEventV1` + correlation key；任何关键动作必须产出可导出的证据条目（见 §8）。
- **可回退/可补偿**：明确动作可逆性分层（撤稿/撤发布/工单状态回滚等）与不可逆动作的升级确认策略（见 §7）。
- **可导出报告**：从“原始日志”到“审计报告”需要摘要层：who/why/what/result/hash（可复核），并支持链路包与会话包导出。
- **双人记录（可选但推荐）**：内容写稿/改写/素材合成等高风险链路提供“AI 预审 + 人工复核”节点，审计记录需体现“双人/双阶段”签收。

> 结论：M1/M2 提供业务价值；G0 保证价值在可控边界内交付，并让 Dev 端经验可被安全下沉到 C/B。

## 3. 三维执行架构 + 两个「必须显式化」的维度

### 3.1 控制面（Control Plane）

- **组件**：`evaluatePolicy`（含快照/总闸）、`EthicsGuard` / `LocalEthicsGuard`、`ContentShield`（输出侧）、出站 `runOutbound` 确认语义、稳定 **ruleId**（见对齐表）。  
- **输出**：结构化 **allow / deny / revise** + 原因码 + **`UnifiedAuditEventV1`**（或与 envelope 兼容的字段）。  
- **原则**：**fail-closed** 可配置但生产默认严格（与现网 `policyEvaluation` 一致）。

### 3.2 编排面（Orchestration Plane）

- **现状**：`WorkflowEngine`、执行链日志、E4 可撤销与补偿上下文。  
- **演进**：显式 **编排图**（角色 = 策略约束下的执行单元），步骤间传递 **受 schema 约束** 的契约，而非原始自然语言乱跑。  
- **多智能体**：工程上等价于 **「受控子图 + 明确 owner」**；通信协议优先复用 **Ingress/契约 trace** 风格（eventId、traceId、payload schemaVersion），再考虑专用 agent-to-agent 通道。  
- **仲裁**：优先 **policy + risk budget + 人类确认（E2）+ 审计理由码**；“投票/辩论”若引入，**必须**产出可归档的裁决记录（否则不满足 B 端可解释性）。

**三层演进（与提案收敛，避免对外承诺倒序）**：

- **翻译层（Translator）**：自然语言 → 结构化意图/参数包/步骤草案（默认不代执行）。  
- **调度层（Orchestration Shell）**：以适配器/代理壳对接外部 Agent（非侵入、可审计），但“全程可观测/可回退”须按能力分级承诺。  
- **执行层（Execution Plane）**：本地 Runtime（CLI/Docker/未来守护进程）负责受控执行与证据链；浏览器沙箱无法承担系统级代码执行与安装。

> 工程侧分级与对外承诺口径见 `INTDONE_TECH_PLAN_v1.md` §0.2.5 · I（可观测/可回退/可审计等级）。

### 3.3 执行面（Execution Plane）

- **组件**：Skills、Mock/真实连接器、未来 LLM 适配器、文件/命令/网络（均在 capability 声明下）。  
- **执行环境可插拔**（Intdeck 先行）：与业界「多后端」思路一致 —— **本地 / 容器 / SSH-远端 VM 等**作为 **ExecutionBackend** 实现，统一挂载：  
  - 资源上限（CPU/内存/时长）  
  - 网络策略（默认 deny，白名单放行）  
  - 审计 hooks（每步产物 hash / correlation）  
- **物理世界**：默认为 **数字孪生优先** —— 先在仿真/孪生环境验证计划与约束，再映射到受控物理接口；禁止从 Intdeck 默认直驱高危物理执行。

**落地顺序（写死，避免“先做产品 UI 再补执行底盘”）**：

- **先 CLI（R0）**：以本地命令行形态跑通“会话 → 计划/步骤 → 受控工具调用 → 证据链导出”的最小闭环，默认能力最窄（fail-closed）。
- **再 Docker（R1）**：在不改变 `core/` 契约与证据语义的前提下，把同一 runtime 放进容器执行，补齐资源上限/网络白名单等“可部署隔离”能力。
- **后续扩展（R2）**：ExecutionBackend 与 capabilities/审计 hooks 接口版本化固定，确保与成熟产品线处于同一能力谱系，向后扩展而非重写底盘。

> 里程碑与验收口径见 `INTDONE_TECH_PLAN_v1.md` §0.2.3（R0–R2）。  
> **阶段执行与收尾模板**（自检、文档回填、提交节奏）：见同文档 **§0.2.4**。  
> **R1-a（容器入口）**：仓库根 `Dockerfile.intdeck-agent` + `docker-compose.intdeck.yml`，命令见 **`DEPLOYMENT.md`**。  
> **R1-b（能力声明）**：`config/intdeck-agent.default.json` + `INTDECK_AGENT_CONFIG` / `--config=`，快照写入 **`experience.export.json`** 的 **`manifest.intdeckAgentRuntime`**（含 `configSha256`）。  
> **R1-c（资源与出站）**：compose 内 **CPU/内存/pids** 上限；**`intdeck-agent-offline`**（`network_mode: none`）与声明层 **`networkEgress`** 对齐；CLI 可选 **`INTDECK_AGENT_TIMEOUT_MS`**；详见 **`DEPLOYMENT.md`**「R1-c」与 **`INTDONE_TECH_PLAN_v1.md`** §0.2.4 **§F**；方向性产品判断见同文档 **§0.2.5**。  
> **R2-a（ExecutionBackend）**：**`ExecutionBackendV1`**（`schemaVersion` + `kind`：`local-process` | `docker` | `remote` 占位）经 **`runIntdeckAgentR0DemoG0`** 写入 G0 **`inputSnapshot.executionBackend`**；本地与 Docker **同一实现路径**，见 **`DEPLOYMENT.md`**「R2-a」与 **`INTDONE_TECH_PLAN_v1.md`** §0.2.4 **§G**。

### 3.4 经济维度（FinOps）—— 一等公民，与 Security / Ethics 并列

**问题定义**：多角色、多轮 LLM 与工具调用会导致 **成本爆炸**；若无预算，企业不可用。  
**工程要求**：

- 在 **Policy Gate**（或紧贴 Pre-LLM）增加 **预算维度**：  
  - **Token / 费用预算**（task 级、session 级、租户级）  
  - **步数 / 并行度 / 子 agent 数量** 上限  
- **超预算策略**（可配置）：降级模型、缩减上下文、暂停队列、**强制人类介入**（E2）或硬 deny（带 `ruleId` / 原因码）。  
- **审计**：预算消耗写入 **correlation**（便于 Dev 导出包与财务/运营归因）。  

> v1.0 **定义契约与挂钩点**；具体计费对接可在阶段 B+ 实现，但**闸门位点不得后移**。

### 3.5 数据维度（记忆治理 → 可选「数据飞轮」）

**记忆（Memory）**：

- **默认**：版本化、可删除、可导出；写入前过 **数据策略**（敏感域、目的、留存 TTL）。  
- **禁止**：静默把用户数据写进「不可解释的黑箱记忆」。

**合成数据 / 黄金链路（Golden Trace）**：

- Intdeck 可作为 **数据工厂**：从**已脱敏、已授权**的「调试通过链路」抽取训练/评测样本。  
- **闭环**：仅在被**明确授权**且**法务/隐私评审通过**的域内：`C/B 原始数据 → B/Dev 清洗与标注 → 垂直小模型/检索库 → 回到 C/B 降成本` —— 这不是默认开启能力，是 **显式产品决策 + 合同 + 技术开关**。  

> 与行业「数据枯竭 → 合成数据」叙事兼容，但 Intdone 的**闸门是合规与同意**，不是算力。

---

## 4. LLM 调用的三环拦截（Intdeck 唯一高自由入口）

所有 **外部 LLM** 调用在 Intdeck 必须经过：

1. **Pre-LLM Gate**（请求发出前）  
   - Policy / Ethics 前置检查中**与 FinOps 预算**合并评估；脱敏与最小化；模型与数据驻留策略；高风险域 **人类确认**。  
2. **Post-LLM Gate**（响应进入执行链前）  
   - Shield、Core AI 伦理输出规则、结构校验；`rulesTriggered` → **`UnifiedAuditEventV1`**。  
3. **Pre-Tool / Outbound Gate**（工具或出站前）  
   - `runOutbound`、角色×敏感域矩阵、连接器策略；（未来）沙箱 capability 校验。

**关键点**：若缺少 **Pre-LLM**，事后审计难以证明「敏感未出境」—— 故 **Pre-LLM 是最强合规拦截面**。

### 4.1 Stage0/Dev 的工程硬闸（避免发布通路污染）

为确保「**隔离发布通路**」原则不被实现细节侵蚀，工程侧增加如下硬约束：

- **C/B 主通路禁止远端 LLM**：`/c/*`、`/b/*` 的执行与持久化路径必须保持模板/本地驱动；不得因“关键词提取/摘要”之类辅助步骤隐式触发远端调用。  
- **远端 LLM 仅 Dev 端显式开启**：仅当满足 **两项条件**时，才允许从浏览器发起 `/api/llm/*`：  
  1) 路由位于 **`/dev/*`**；2) 显式配置 `VITE_ENABLE_REMOTE_LLM=true`。  
- **默认形态不启用 /api 代理**：避免将“存在 server 目录”误解为“默认走后端”。
- **Pre-LLM 证据链**：当 Dev 端显式开启远端 LLM 时，所有 `/api/llm/*` 调用必须经由 **G0 Pre-LLM gate** 产出 `G0ActionReportV1`（含 routeDecision、promptSnapshot hash 等摘要），以保证“可阻断、可审计、可回滚/可补偿”的证据链不断裂。

---

## 5. 交互层：生成式 UI（协议优先）

**问题**：固定页面无法承载千变万化的任务态。  
**v1.0 策略**：

- 不急于做「任意 HTML 由模型生成」；先做 **UI 描述协议（UI Envelope）**：  
  - 任务类型、状态机阶段、所需字段、确认点、风险标签、只读证据引用（指向审计 id / exportSessionId）。  
- **渲染器**在 C/B 侧仅允许**白名单组件集**（审批卡片、表单片段、时间线、证据下载）。  
- 多模态：`Perception Envelope`（时间戳、坐标系声明、来源、敏感级别、留存策略）与 UI 协议 **分轨**，避免把传感器原始流直接喂给不可信渲染路径。

---

## 6. 安全：合规（守）+ 红队（攻）

- **守**：现有 Ethics / Policy /审计已覆盖大部分「事后可解释」。  
- **攻（Intdeck）**：建立 **发布前红队闸**（可自动化）：  
  - 提示注入、规则绕过、越权 outbound、预算耗尽逃逸、伪造审计字段等**攻击剧本**。  
  - **未通过红队闸门**的策略/插件/编排模板 **不得**进入 C/B 默认发布渠道。  
- **R2-b（文档与默认参数闭环）**：红队最小集单测（`npm run redteam:v0`）与 **`DEPLOYMENT.md`** 中 Intdeck **默认能力 JSON**（`networkEgress=deny`）、**compose 离线服务** 交叉引用，见 **`INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md`** §4.1、**`INTDONE_TECH_PLAN_v1.md`** §0.2.4 **§H**。

> 「多智能体辩论」与「红队」不同：前者是**产品仲裁策略**；后者是**安全压测**，输出的是 **pass/fail + 证据**。

### 6.1 威胁分层与开源 / 商业边界（摘要）

- **L1 / L2 / L3** 三层防御与经验存储、插件的映射见 `INTDONE_INTDECK_EXPERIENCE_STORAGE_AND_THREAT_MODEL_v1.md` §3.2；与 **Phase D5** 红队闸的关系见该备忘 §3.1。  
- **两套实体**（主系统 Dev 端 vs 开源 baseline）、**拆仓代码断交**与 **季度 meta 对齐（披露义务）** 见 `INTDONE_INTDECK_BASELINE_AND_REPO_BOUNDARY_v1.md` §3–§5。

---

## 7. 权限与「全域托管」边界（重申）

- 权限模型采用 **能力集合（capabilities）+ 策略快照 + 审计**，不以模糊角色名代替。  
- **不存在默认「全域托管」**；若用户提供「自愿全托管」，必须：显式范围（scope/purpose/TTL）、能力上限、kill switch、强审计、隔离执行、可撤销/可补偿路径 —— **并在 FinOps 下可计费可中止**。  
- **沙箱**只解决执行隔离，不解决业务合规；业务合规仍在治理面三连闸。

---

## 8. 与现网代码的映射（落地锚点）

| 设计块 | 现有落点（示例） | 后续演进（Intdeck 优先） |
|--------|------------------|--------------------------|
| 统一审计 | `unifiedAuditSchema.ts`、`unifiedAuditRingLog.ts`、`AiCoreLogEntry.auditEventV1`、`financialAuditStore.auditEventV1` | correlation 键扩展（session/intent/trace）、会话级报告 |
| 财务链路关联 | `correlateFinancialExportBySessionId`、`/dev/logs` | 与环形缓冲、策略回放联动 |
| **G0 强制治理模块（必经闸门 + 报告）** | `core/governance/g0Shell.ts`（`runG0Action`，缺关键字段 fail-closed）、`core/governance/g0ReportStore.ts`（`intdone_g0_action_reports_v1`）、`core/governance/g0Outbound.ts`（`runG0OutboundAction`）、`core/governance/g0LlmGate.ts`（`runG0LlmCall` stub）、Dev `/dev/logs`「G0 动作报告」 | 接入 Policy/Ethics/Outbound 三环闸门的真实判定；报告摘要层与会话包/链路包统一导出 |
| 出站 | `runOutbound`、`outboundEthics.ts`、`runG0OutboundAction` | 连接器门禁与 FinOps |
| 工作流 | `WorkflowEngine`、E4 伦理、`workflowFailureLog` | 编排图、子 agent 边界 |
| Dev 区隔 | `appProfile`、`routeAccess`、`Layout` 琥珀条、`VITE_ENABLE_DEV_WORKSPACE` | ExecutionBackend（容器/远端） |

---

## 9. 分阶段路线图（架构 v1.0 内）

1. **Phase D0（已部分完成）**：统一 audit + Dev 导出/关联 + TECH_PLAN 排期回填。  
2. **Phase D1（强制治理模块 G0 先行）**：将“合法/合规/可观测/可审计/可回退/可导出报告”明确为 **G0 必经层**，并固化 **导出报告摘要层**（who/why/what/result/hash）与 correlation key；M1/M2 业务能力只能通过 G0 执行壳落地。  
3. **Phase D2（两大固定模块落地）**：优先落地 M1（Ops Console）与 M2（Growth Factory）的对象模型与最小闭环；所有写入类动作必须经 `runOutbound` + 人类确认（可配置）并产出审计链路包。  
4. **Phase D3（LLM 三环网关接口固化）**：Pre-LLM / Post-LLM / Pre-Tool 网关 **接口固化**（可先 stub，位点不可逆），将 LLM 接入锁定为 Intdeck 唯一高自由入口并受控。  
5. **Phase D4（FinOps 一等公民）**：预算进 Policy Gate；在 Dev 视图可观测 token/成本与熔断；仲裁机制引入“性价比”评价（输出可审计理由码）。  
6. **Phase D5（红队闸门 + 多角色编排）**：红队最小集进 CI/Dev 发布流；编排图 + 多角色网络（仍强审计），并保证“发布通路隔离、架构成长通路共享”。  
7. **Phase D6（远期，可选）**：数字孪生/仿真执行通道（仅 Intdeck）；生成式 UI 协议 v0 与白名单渲染器；授权域内黄金链路/合成数据 pipeline。

---

## 10. 文档治理

- 本文档 **v1.0** 描述 **到 3–5 年的架构意志** 与 **近 1–2 年的工程挂钩点**；细则变更用 **修订记录** 追加，不随意升主版本号。  
- 与 `INTDONE_TECH_PLAN_v1.md` 冲突时：  
  - **产品发布门禁与里程碑**以 TECH_PLAN 为准；  
  - **Intdeck/自治与治理架构**以本文为准，并反填 TECH_PLAN 对应小节。

---

## 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04 | v1.0 | 初稿：五层视图、三环拦截、FinOps/数据飞轮/生成式UI/红队/数字孪生收敛为工程语言；公理「隔离发布通路、非架构成长通路」 |
| 2026-04 | v1.0 | G0 从“记录与导出壳”升级为“必经闸门”（fail-closed）；新增 outbound/LLM gate 的 G0 包壳位点并在 Dev 示例动作中落地 |
| 2026-04 | v1.0 | §1.1.1 两套实体（Dev 端 / baseline）与拆仓约束；§6.1 威胁分层与边界文档交叉引用 |
| 2026-04 | v1.0 | §3.3 交叉引用 `INTDONE_TECH_PLAN_v1.md` §0.2.4（阶段收尾模板） |
| 2026-04 | v1.0 | §3.3 补充 R1-a：Dockerfile.intdeck-agent / compose 与 `DEPLOYMENT.md` 锚点 |
| 2026-04 | v1.0 | §3.3 补充 R1-b：intdeck-agent 配置与 `experience.export.json` manifest |
| 2026-04 | v1.0 | §3.3 补充 R1-c：compose 资源上限、offline 无出站、`INTDECK_AGENT_TIMEOUT_MS` |
| 2026-04 | v1.0 | §3.3 补充 R2-a：`ExecutionBackendV1` 与 `runIntdeckAgentR0DemoG0` |
| 2026-04 | v1.0 | §6 补充 R2-b：红队 v0 与 DEPLOYMENT/威胁模型 §4.1 交叉引用 |
