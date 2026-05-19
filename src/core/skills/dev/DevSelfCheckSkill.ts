/**
 * DevSelfCheckSkill — AI 自检 Skill
 *
 * 职责：
 *   1. 根据阶段配置生成自检清单（dryRun=true）或结构化检查报告框架
 *   2. 在 CLI 侧（dev-phase-runner.mjs）实际执行命令并写入 GateResult
 *   3. 输出 SelfCheckReport（JSON），写入 G0 审计
 *
 * ⚠️  浏览器侧仅支持 dryRun=true（无法执行 shell 命令）。
 *     实际执行由 scripts/dev-phase-runner.mjs 完成，该脚本直接
 *     调用本 Skill 的类型定义并实例化报告结构。
 *
 * 伦理覆盖：E3（输出可解释）、E6（审计可追溯）
 *
 * @see docs/AI_DEV_ASSISTANT_WORKFLOW_v1.md
 * @see scripts/dev-phase-runner.mjs
 * @see INTDONE_TECH_PLAN_v1.md §0.2.4 §A（每阶段固定四件事）
 */

import type { Skill, SkillInput, SkillOutput } from '../types';
import type { SystemMeta } from '../../system/types';
import { appendUnifiedAuditRingEvent } from '../../observability/unifiedAuditRingLog';
import { buildUnifiedAuditEventV1 } from '../../observability/unifiedAuditSchema';
import type {
  DevSelfCheckSkillInput,
  SelfCheckReport,
  GateResult,
  SelfCheckGateId,
  DevPhaseId,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 阶段 → 门禁映射（与 ai-dev-assistant.json 保持一致）
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_GATES: Record<string, SelfCheckGateId[]> = {
  'stage-A':       ['lint', 'test', 'build', 'smoke:profile', 'redteam:v0', 'lint:themes'],
  'B0':            ['lint', 'test', 'build', 'redteam:v0'],
  'B1':            ['lint', 'test', 'build', 'smoke:profile', 'redteam:v0'],
  'FE-SRV-B1':     ['lint', 'test', 'build', 'redteam:v0'],
  'B2':            ['lint', 'test', 'build', 'redteam:v0', 'export:intdeck-baseline'],
  'B3':            ['lint', 'test', 'build', 'redteam:v0', 'export:intdeck-baseline'],
  'stage-C':       ['lint', 'test', 'build', 'redteam:v0'],
};

const GATE_CMDS: Record<SelfCheckGateId, string> = {
  'lint':                    'npm run lint',
  'test':                    'npm test',
  'build':                   'npm run build',
  'smoke:profile':           'npm run smoke:profile',
  'redteam:v0':              'npm run redteam:v0',
  'lint:themes':             'npm run lint:themes',
  'export:intdeck-baseline': 'npm run export:intdeck-baseline -- --dry-run',
};

// ─────────────────────────────────────────────────────────────────────────────
// Skill 实现
// ─────────────────────────────────────────────────────────────────────────────

export class DevSelfCheckSkill implements Skill {
  id = 'dev-self-check';
  type = 'guidance' as const;
  metadata = {
    name: 'AI 自检 Skill',
    description:
      '根据阶段配置生成自检清单（dryRun 模式）或从外部接收实际执行结果并输出 SelfCheckReport。' +
      '所有结果写入统一审计环形缓冲（E6）。',
    requiresNetwork: false,
    ethicalPrinciples: ['E3', 'E6'] as ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[],
  };

  async execute(input: SkillInput, meta: SystemMeta): Promise<SkillOutput> {
    const typedInput = input as unknown as DevSelfCheckSkillInput & {
      /** 由 CLI runner 注入的实际执行结果（非 dryRun 时） */
      gateResults?: GateResult[];
    };

    const phaseId: DevPhaseId = typedInput.phaseId ?? 'B1';
    const dryRun = typedInput.dryRun !== false; // 浏览器侧默认 dryRun
    const requestedGates = typedInput.gates ?? PHASE_GATES[phaseId] ?? ['lint', 'test', 'build', 'redteam:v0'];

    let gates: GateResult[];

    if (dryRun || !typedInput.gateResults) {
      // dryRun：生成清单骨架，passed = null（待实际运行）
      gates = requestedGates.map((gate) => ({
        gate,
        cmd: GATE_CMDS[gate] ?? `npm run ${gate}`,
        passed: false, // 待运行
        durationMs: 0,
        errorSummary: '(dryRun — 未实际执行)',
      }));
    } else {
      // 由 CLI 注入真实结果
      gates = typedInput.gateResults;
    }

    const failedGates = dryRun
      ? [] // dryRun 不算失败
      : gates.filter((g) => !g.passed).map((g) => g.gate);

    const overallPassed = dryRun ? true : failedGates.length === 0;

    const report: SelfCheckReport = {
      schemaVersion: 1,
      phaseId,
      ranAt: new Date().toISOString(),
      overallPassed,
      gates,
      failedGates,
      nextStepSuggestion: this._buildNextStep(phaseId, failedGates, dryRun),
    };

    // E6：写入审计环形缓冲
    appendUnifiedAuditRingEvent(
      buildUnifiedAuditEventV1({
        rulesTriggered: [],
        verdict: overallPassed ? 'allow' : 'block',
        reason: dryRun
          ? `DevSelfCheckSkill: dryRun 生成 ${phaseId} 自检清单`
          : `DevSelfCheckSkill: ${phaseId} 自检${overallPassed ? '通过' : '失败'}（失败门禁: ${failedGates.join(', ') || '无'}）`,
        correlation: {
          channel: 'dev_self_check_skill',
          phaseId,
          dryRun,
          stage: meta.stage,
          failedGates,
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
        dryRun,
        overallPassed,
        failedGates,
      },
    };
  }

  private _buildNextStep(
    phaseId: DevPhaseId,
    failedGates: SelfCheckGateId[],
    dryRun: boolean
  ): string {
    if (dryRun) {
      return (
        `在终端运行 \`npm run dev:check -- --phase=${phaseId}\` 触发实际自检，` +
        `或逐项运行上述命令并将结果回填至 SelfCheckReport。`
      );
    }
    if (failedGates.length === 0) {
      return (
        `✅ 阶段 ${phaseId} 自检全部通过。下一步：运行 \`npm run dev:redteam -- --phase=${phaseId}\` ` +
        `触发红队模式，然后回填文档并提交。`
      );
    }
    const firstFail = failedGates[0];
    return (
      `❌ 门禁 [${firstFail}] 未通过，请先修复后重跑 \`${GATE_CMDS[firstFail]}\`。` +
      `全部失败门禁：${failedGates.join(', ')}。`
    );
  }
}
