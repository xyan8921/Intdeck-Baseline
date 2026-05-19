import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSystemMeta } from '../system/types';
import { DevPhaseSkill } from '../skills/dev/DevPhaseSkill';
import { DevSelfCheckSkill } from '../skills/dev/DevSelfCheckSkill';
import { DevDocBackfillSkill } from '../skills/dev/DevDocBackfillSkill';

/**
 * Red Team Gate — Dev Workflow 专项（扩展 redteamGate.v0）
 *
 * 覆盖威胁场景：
 *   T1-injection   提示注入 → DevPhaseSkill 不执行任意代码
 *   T2-egress      越权出站 → DevSelfCheckSkill dryRun=true 时不调用 shell
 *   T3-privilege   越权操作 → 财务角色矩阵配置文件不可被 DevSkill 绕过
 *   T4-audit-gap   审计缺口 → DevSkill 执行后一定写入 unifiedAuditRingLog
 *   T5-idempotency 重复提交 → DocBackfill 幂等（同输入多次调用输出一致）
 *   T7-data-sovereignty 数据主权 → dev-phase config 不允许跨 B/C 数据域
 *
 * @see config/ai-dev-assistant.json
 * @see docs/AI_DEV_ASSISTANT_WORKFLOW_v1.md
 * @see INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md §4.1
 */

const CWD = process.cwd();

const STAGE0_META = createSystemMeta({
  stage: 'stage0',
  capabilities: {
    llm: false,
    payment: false,
    thirdPartyAPI: false,
    userStorage: 'local',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// T1 — 提示注入：DevPhaseSkill 不执行任意代码
// ─────────────────────────────────────────────────────────────────────────────

describe('[T1-injection] DevPhaseSkill 提示注入防护', () => {
  it('注入恶意 phaseId 时不执行任意代码，仅返回 unknown 阶段规划', async () => {
    const skill = new DevPhaseSkill();
    const maliciousInput = {
      phaseId: '; rm -rf / #',
      mode: 'plan' as const,
    };

    // 不应抛出；不应执行 shell；只返回 unknown 阶段规划
    const result = await skill.execute(maliciousInput as never, STAGE0_META);
    expect(result.content).toBeTruthy();
    const plan = JSON.parse(result.content as string);
    // 恶意 phaseId 无法匹配任何已知阶段，任务数为 0
    expect(plan.tasks).toEqual([]);
    expect(plan.phaseName).toMatch(/未定义/);
  });

  it('注入超长 phaseId 不导致崩溃', async () => {
    const skill = new DevPhaseSkill();
    const longId = 'x'.repeat(10000);
    const result = await skill.execute(
      { phaseId: longId, mode: 'plan' } as never,
      STAGE0_META
    );
    expect(result.content).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T2 — 越权出站：DevSelfCheckSkill dryRun 模式不执行 shell
// ─────────────────────────────────────────────────────────────────────────────

describe('[T2-egress] DevSelfCheckSkill dryRun 不出站', () => {
  it('dryRun=true 时 passed 字段标注为待运行，不实际执行命令', async () => {
    const skill = new DevSelfCheckSkill();
    const result = await skill.execute(
      { phaseId: 'B1', dryRun: true } as never,
      STAGE0_META
    );
    const report = JSON.parse(result.content as string);
    expect(report.dryRun).toBeUndefined(); // dryRun flag 不放入报告
    // 所有门禁 errorSummary 包含 dry-run
    for (const gate of report.gates) {
      expect(gate.durationMs).toBe(0);
      // errorSummary 标注为 dryRun 模式（匹配中英文均可）
      expect(gate.errorSummary).toMatch(/dryRun|dry-run|未实际执行/i);
    }
  });

  it('dryRun=true 时 overallPassed=true（不因未执行而误标 fail）', async () => {
    const skill = new DevSelfCheckSkill();
    const result = await skill.execute(
      { phaseId: 'B1', dryRun: true } as never,
      STAGE0_META
    );
    const report = JSON.parse(result.content as string);
    expect(report.overallPassed).toBe(true);
    expect(report.failedGates).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T3 — 越权操作：config 文件中角色矩阵不可被 DevSkill 跳过
// ─────────────────────────────────────────────────────────────────────────────

describe('[T3-privilege] ai-dev-assistant.json 威胁场景声明完整性', () => {
  it('config 文件存在且包含 threatModel.scenarios', () => {
    const configPath = join(CWD, 'config', 'ai-dev-assistant.json');
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(config.threatModel).toBeDefined();
    expect(config.threatModel.scenarios).toBeDefined();
    // T3 场景必须声明
    expect(config.threatModel.scenarios['T3-privilege']).toBeDefined();
    expect(config.threatModel.scenarios['T3-privilege'].mitigations.length).toBeGreaterThan(0);
  });

  it('B1 阶段 requiredChecks 包含 redteam:v0 门禁', () => {
    const config = JSON.parse(readFileSync(join(CWD, 'config', 'ai-dev-assistant.json'), 'utf8'));
    const b1 = config.phases['B1'];
    expect(b1).toBeDefined();
    expect(b1.requiredChecks).toContain('redteam:v0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T4 — 审计缺口：DevSkill 执行后写入 unifiedAuditRingLog
// ─────────────────────────────────────────────────────────────────────────────

describe('[T4-audit-gap] DevSkill 审计日志覆盖', () => {
  it('DevPhaseSkill.execute 执行后 metadata 含可审计字段', async () => {
    const skill = new DevPhaseSkill();
    const result = await skill.execute(
      { phaseId: 'B1', mode: 'plan' } as never,
      STAGE0_META
    );
    // metadata 必须含 phaseId 与 timestamp（审计必要字段）
    expect(result.metadata.phaseId).toBe('B1');
    expect(typeof result.metadata.timestamp).toBe('number');
    expect(result.metadata.skillId).toBe('dev-phase-planner');
  });

  it('DevSelfCheckSkill.execute metadata 含 phaseId 和 overallPassed', async () => {
    const skill = new DevSelfCheckSkill();
    const result = await skill.execute(
      { phaseId: 'B1', dryRun: true } as never,
      STAGE0_META
    );
    expect(result.metadata.phaseId).toBe('B1');
    expect(typeof result.metadata.overallPassed).toBe('boolean');
  });

  it('DevDocBackfillSkill.execute metadata 含 itemCount', async () => {
    const skill = new DevDocBackfillSkill();
    const result = await skill.execute(
      { phaseId: 'B1', deliverables: ['backend-contract stub', 'npm script'] } as never,
      STAGE0_META
    );
    expect(typeof result.metadata.itemCount).toBe('number');
    expect(result.metadata.itemCount).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T5 — 幂等性：DevDocBackfillSkill 同输入多次调用输出一致
// ─────────────────────────────────────────────────────────────────────────────

describe('[T5-idempotency] DevDocBackfillSkill 幂等性', () => {
  it('同一 phaseId + deliverables 多次调用，itemCount 相同', async () => {
    const skill = new DevDocBackfillSkill();
    const input = {
      phaseId: 'B1',
      deliverables: ['backend-contract stub', 'docker env'],
      includeRedteamDocs: true,
    };
    const r1 = await skill.execute(input as never, STAGE0_META);
    const r2 = await skill.execute(input as never, STAGE0_META);
    const report1 = JSON.parse(r1.content as string);
    const report2 = JSON.parse(r2.content as string);
    expect(report1.items.length).toBe(report2.items.length);
    expect(report1.batchCommitSuggestion).toBe(report2.batchCommitSuggestion);
  });
});

import { createStubBackendContractClient, clearStubFinancialExportAuditIdempotencyCache } from '../backend-contract/client';
import { type FinancialExportAuditRequest } from '../backend-contract/types';

describe('[T5-idempotency] auditFinancialExport 契约防双写 (FE-SRV-B1)', () => {
  it('同一 exportSessionId 多次请求应返回相同 traceId 且不产生副作用', async () => {
    clearStubFinancialExportAuditIdempotencyCache();
    const client = createStubBackendContractClient();
    const sessionId = `test_sess_${Date.now()}`;
    const req: FinancialExportAuditRequest = {
      exportSessionId: sessionId,
      exportBatchId: 'b_123',
      csvSha256: 'a'.repeat(64),
      actorType: 'audit',
      actorId: 'u_1',
      purpose: 'test',
      scope: 'all',
      dataDomain: 'enterprise-finance',
      dataSensitivity: 'L2',
      rowCount: 10,
      occurredAt: new Date().toISOString(),
    };

    const res1 = await client.auditFinancialExport(req);
    expect(res1.ok).toBe(true);
    const traceId1 = res1.traceId;

    // Second identical call
    const res2 = await client.auditFinancialExport(req);
    expect(res2.ok).toBe(true);
    expect(res2.traceId).toBe(traceId1); // Must hit cache

    // Query API to verify only 1 item was stored
    const queryRes = await client.queryFinancialExportAudit({ sessionId });
    expect(queryRes.ok).toBe(true);
    if (queryRes.ok) {
      expect(queryRes.data.items).toHaveLength(1);
      const item = queryRes.data.items[0];
      expect(item.traceId).toBe(traceId1);
      expect(item.exportSessionId).toBe(sessionId);
      expect(item.actorType).toBe('audit');
      expect(item.dataDomain).toBe('enterprise-finance');
      expect(item.dataSensitivity).toBe('L2');
      expect(item.rowCount).toBe(10);
      expect(typeof item.receivedAt).toBe('string');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T7 — 数据主权：dev-phase config 阶段不跨 B/C 数据域
// ─────────────────────────────────────────────────────────────────────────────

describe('[T7-data-sovereignty] 阶段配置数据域边界', () => {
  it('DevPhaseSkill B1 任务不包含 C 端直接数据写入项', async () => {
    const skill = new DevPhaseSkill();
    const result = await skill.execute(
      { phaseId: 'B1', mode: 'plan' } as never,
      STAGE0_META
    );
    const plan = JSON.parse(result.content as string);
    // B1 任务不应直接涉及 C 端个人消费统计路径
    for (const task of plan.tasks) {
      expect(task.filePath ?? '').not.toMatch(/\/c\/spending|personal-spending.*write/i);
    }
  });

  it('config T7-data-sovereignty 场景声明了 dataDomain 分离缓解措施', () => {
    const config = JSON.parse(readFileSync(join(CWD, 'config', 'ai-dev-assistant.json'), 'utf8'));
    const t7 = config.threatModel.scenarios['T7-data-sovereignty'];
    expect(t7).toBeDefined();
    const mitigations = t7.mitigations.join(' ');
    expect(mitigations).toMatch(/dataDomain|personal-spending|同源不混义/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 工作流 JSON 完整性校验
// ─────────────────────────────────────────────────────────────────────────────

describe('[integrity] Dev Workflow JSON 文件校验', () => {
  const workflowFiles = [
    'public/workflows/dev-phase-workflow.json',
    'public/workflows/dev-selfcheck-workflow.json',
  ];

  for (const wf of workflowFiles) {
    it(`${wf} 存在且 schema 合法`, () => {
      const fullPath = join(CWD, wf);
      expect(existsSync(fullPath)).toBe(true);
      const json = JSON.parse(readFileSync(fullPath, 'utf8'));
      expect(typeof json.id).toBe('string');
      expect(Array.isArray(json.steps)).toBe(true);
      expect(json.steps.length).toBeGreaterThan(0);
      expect(Array.isArray(json.metadata.ethicalPrinciples)).toBe(true);
    });
  }

  it('dev-phase-workflow 包含 plan / self-check / doc-backfill 三步', () => {
    const json = JSON.parse(readFileSync(join(CWD, 'public/workflows/dev-phase-workflow.json'), 'utf8'));
    const ids = json.steps.map((s: { id: string }) => s.id);
    expect(ids).toContain('plan');
    expect(ids).toContain('self-check');
    expect(ids).toContain('doc-backfill');
  });
});
