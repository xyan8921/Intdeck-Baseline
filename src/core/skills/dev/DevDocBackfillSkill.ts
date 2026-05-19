/**
 * DevDocBackfillSkill — AI 文档回填 Skill
 *
 * 职责：
 *   1. 接收本阶段交付物列表
 *   2. 生成需要更新的文档清单（DocBackfillItem[]）
 *   3. 为每个文档生成具体的更新指引和建议 commit message
 *   4. 输出 DocBackfillReport（JSON），写入 G0 审计
 *
 * ⚠️  本 Skill 只生成"应该更新什么"的报告，不自动写文件。
 *     文件修改由开发者（或 CLI --auto-doc 模式）完成。
 *
 * 伦理覆盖：E3（可解释）、E4（不代执行）、E6（审计可追溯）
 *
 * @see docs/AI_DEV_ASSISTANT_WORKFLOW_v1.md
 * @see INTDONE_TECH_PLAN_v1.md §0.2.4 §A 第2条（文档回填最小集）
 */

import type { Skill, SkillInput, SkillOutput } from '../types';
import type { SystemMeta } from '../../system/types';
import { appendUnifiedAuditRingEvent } from '../../observability/unifiedAuditRingLog';
import { buildUnifiedAuditEventV1 } from '../../observability/unifiedAuditSchema';
import type {
  DevDocBackfillSkillInput,
  DocBackfillReport,
  DocBackfillItem,
  DevPhaseId,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 文档回填规则表（与 ai-dev-assistant.json docBackfillTemplate 对应）
// ─────────────────────────────────────────────────────────────────────────────

interface DocRule {
  docPath: string;
  section?: string;
  updateType: DocBackfillItem['updateType'];
  description: string;
  condition?: (deliverables: string[], includeRedteam: boolean) => boolean;
  suggestedCommit?: (phaseId: DevPhaseId) => string;
}

const DOC_RULES: DocRule[] = [
  // ── 始终回填 ───────────────────────────────────────────────────────────────
  {
    docPath: 'docs/INTDONE_TECH_PLAN_v1.md',
    section: '§0.2.4 阶段状态',
    updateType: 'status-mark',
    description: '将本阶段里程碑行标记为 ✅ 并补充"已落盘"说明（C/D 段模板）',
    suggestedCommit: (p) => `docs(tech-plan): mark ${p} milestones done`,
  },
  {
    docPath: 'README.md',
    section: '## Scripts',
    updateType: 'cross-ref',
    description: '若本阶段新增 npm script，在 README Scripts 表格补充命令与说明',
    condition: (d) => d.some((x) => x.includes('script') || x.includes('npm')),
    suggestedCommit: (p) => `docs(readme): add ${p} npm script entries`,
  },
  {
    docPath: 'DEPLOYMENT.md',
    section: '## Docker / 环境变量',
    updateType: 'cross-ref',
    description: '若涉及 Docker/环境变量/产物路径变化，更新 DEPLOYMENT.md 对应章节',
    condition: (d) => d.some((x) => x.includes('docker') || x.includes('env') || x.includes('Deploy')),
    suggestedCommit: (p) => `docs(deployment): update ${p} env and docker entries`,
  },

  // ── 条件回填：财务 ──────────────────────────────────────────────────────────
  {
    docPath: 'docs/INTDONE_FINANCIAL_ARCHITECTURE_v1.md',
    section: '§3 财务子模块进展',
    updateType: 'milestone-row',
    description: '若本阶段涉及财务审计、导出或 B 端财务观测，更新里程碑表格行',
    condition: (d) => d.some((x) => /financ|audit|export|B端财务/.test(x)),
    suggestedCommit: (p) => `docs(finance): backfill ${p} financial audit milestone`,
  },
  {
    docPath: 'docs/INTDONE_STAGE_B_CONTRACTS_PREWORK_v1.md',
    section: '§4 B 阶段契约进展',
    updateType: 'milestone-row',
    description: '若本阶段涉及后端契约、Stub、Ingress/Orchestrator/Policy，更新进展',
    condition: (d) => d.some((x) => /contract|stub|ingress|orchestrat|policy|B0|B1|FE-SRV/.test(x)),
    suggestedCommit: (p) => `docs(stage-b): backfill ${p} contract prework milestone`,
  },

  // ── 条件回填：Intdeck/红队 ──────────────────────────────────────────────────
  {
    docPath: 'docs/INTDONE_INTDECK_ARCHITECTURE_AND_TECH_DESIGN_v1.md',
    section: '§3.3 ExecutionBackend',
    updateType: 'cross-ref',
    description: '若本阶段涉及 ExecutionBackend、capabilities、audit hooks，更新架构交叉引用',
    condition: (d) => d.some((x) => /executionBackend|capabilities|intdeck/.test(x)),
    suggestedCommit: (p) => `docs(intdeck-arch): cross-ref ${p} ExecutionBackend changes`,
  },
  {
    docPath: 'docs/INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md',
    section: '§4.1 红队用例表',
    updateType: 'milestone-row',
    description: '若本阶段新增红队测试或覆盖新威胁场景，更新白皮书 §4.1',
    condition: (_d, includeRedteam) => includeRedteam,
    suggestedCommit: (p) => `docs(threat-model): add ${p} redteam coverage to §4.1`,
  },
  {
    docPath: 'docs/INTDONE_ETHICS_RULE_ALIGNMENT_v1.md',
    section: '§5 对齐表',
    updateType: 'cross-ref',
    description: '若本阶段新增或修改了伦理规则落点，更新对齐表 §5',
    condition: (d) => d.some((x) => /ethics|E[1-6]|ruleId|EthicsGuard/.test(x)),
    suggestedCommit: (p) => `docs(ethics): update ${p} rule alignment §5`,
  },
  {
    docPath: 'docs/AI_DEV_ASSISTANT_WORKFLOW_v1.md',
    section: '## 阶段进度',
    updateType: 'milestone-row',
    description: '在 AI Dev Assistant 工作流文档中标记本阶段完成状态',
    condition: (d) => d.some((x) => /dev.*assist|DevPhase|DevSelf|DevDoc/.test(x)),
    suggestedCommit: (p) => `docs(ai-dev): mark ${p} complete in workflow doc`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Skill 实现
// ─────────────────────────────────────────────────────────────────────────────

export class DevDocBackfillSkill implements Skill {
  id = 'dev-doc-backfill';
  type = 'guidance' as const;
  metadata = {
    name: 'AI 文档回填 Skill',
    description:
      '根据本阶段交付物列表生成文档回填清单与建议 commit message。仅输出"应该更新什么"，不自动写文件（E4 原则）。',
    requiresNetwork: false,
    ethicalPrinciples: ['E3', 'E4', 'E6'] as ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[],
  };

  async execute(input: SkillInput, meta: SystemMeta): Promise<SkillOutput> {
    const typedInput = input as unknown as DevDocBackfillSkillInput;
    const phaseId: DevPhaseId = typedInput.phaseId ?? 'B1';
    const deliverables: string[] = typedInput.deliverables ?? [];
    const includeRedteam = typedInput.includeRedteamDocs ?? false;

    const items: DocBackfillItem[] = DOC_RULES
      .filter((rule) => {
        if (!rule.condition) return true; // 始终执行
        return rule.condition(deliverables, includeRedteam);
      })
      .map((rule) => ({
        docPath: rule.docPath,
        section: rule.section,
        updateType: rule.updateType,
        description: rule.description,
        suggestedCommit: rule.suggestedCommit ? rule.suggestedCommit(phaseId) : undefined,
      }));

    const batchCommit =
      items.length > 3
        ? `docs(${phaseId}): backfill tech plan, cross-refs and milestones`
        : items[0]?.suggestedCommit;

    const report: DocBackfillReport = {
      schemaVersion: 1,
      phaseId,
      generatedAt: new Date().toISOString(),
      items,
      batchCommitSuggestion: batchCommit,
    };

    // E6：写入统一审计
    appendUnifiedAuditRingEvent(
      buildUnifiedAuditEventV1({
        rulesTriggered: [],
        verdict: 'allow',
        reason: `DevDocBackfillSkill: 生成 ${phaseId} 文档回填清单，共 ${items.length} 项`,
        correlation: {
          channel: 'dev_doc_backfill_skill',
          phaseId,
          itemCount: items,
          stage: meta.stage,
        },
        surfaceHint: 'workflow',
      })
    );

    return {
      content: JSON.stringify(report, null, 2),
      format: 'application/json',
      metadata: {
        skillId: this.id,
        timestamp: Date.now(),
        confidence: 1.0,
        phaseId,
        itemCount: items.length,
        batchCommitSuggestion: batchCommit,
      },
    };
  }
}
