import { describe, expect, it } from 'vitest';
import { ToolRegistry, type ToolGateResult } from './toolRegistry';
import type { IntdeckAgentRuntimeManifestV1 } from '../experience/experienceTypes';

/**
 * ToolRegistry 单元测试（Sprint A）：
 *   - 注册 / 列举 / 查询
 *   - evaluateGate：正常 allow / deny 路径
 *   - evaluateGate：未注册工具 fail-closed
 *   - Capability enforcement：networkEgress=deny 阻止出站工具
 *   - Capability enforcement：thirdPartyAPI=false 阻止第三方工具
 *   - Capability enforcement：非出站工具不受 networkEgress 影响
 */

function makeManifest(overrides?: Partial<IntdeckAgentRuntimeManifestV1['capabilities']>): IntdeckAgentRuntimeManifestV1 {
  return {
    schemaVersion: 1,
    loadedFrom: 'test',
    configSha256: 'a'.repeat(64),
    capabilities: {
      llm: false,
      thirdPartyAPI: false,
      networkEgress: 'deny',
      ...overrides,
    },
  };
}

describe('ToolRegistry — 注册与查询', () => {
  it('register + hasTool', () => {
    const r = new ToolRegistry();
    expect(r.hasTool('my-tool')).toBe(false);
    r.register({ toolId: 'my-tool', evaluate: async () => ({ verdict: 'allow', ruleId: 'test.allow' }) });
    expect(r.hasTool('my-tool')).toBe(true);
  });

  it('listTools 返回已注册列表', () => {
    const r = new ToolRegistry();
    r.register({ toolId: 'tool-a', description: 'A', evaluate: async () => ({ verdict: 'allow', ruleId: 'a' }) });
    r.register({ toolId: 'tool-b', evaluate: async () => ({ verdict: 'allow', ruleId: 'b' }) });
    const ids = r.listTools().map((t) => t.toolId);
    expect(ids).toContain('tool-a');
    expect(ids).toContain('tool-b');
  });

  it('同一 toolId 注册两次以最后一次为准', async () => {
    const r = new ToolRegistry();
    r.register({ toolId: 'dup', evaluate: async () => ({ verdict: 'deny', ruleId: 'v1' }) });
    r.register({ toolId: 'dup', evaluate: async () => ({ verdict: 'allow', ruleId: 'v2' }) });
    const res = await r.evaluateGate('dup', {});
    expect(res.verdict).toBe('allow');
    expect(res.ruleId).toBe('v2');
  });
});

describe('ToolRegistry — evaluateGate 基本路径', () => {
  it('未注册工具返回 deny + TOOL_NOT_REGISTERED', async () => {
    const r = new ToolRegistry();
    const res = await r.evaluateGate('ghost-tool', {});
    expect(res.verdict).toBe('deny');
    expect(res.code).toBe('TOOL_NOT_REGISTERED');
  });

  it('已注册工具调用 evaluate 函数', async () => {
    const r = new ToolRegistry();
    r.register({
      toolId: 'q-tool',
      evaluate: async (req) => ({
        verdict: 'allow',
        ruleId: 'q.allow',
        reason: `req=${JSON.stringify(req)}`,
      }),
    });
    const res = await r.evaluateGate('q-tool', { x: 1 });
    expect(res.verdict).toBe('allow');
    expect(res.reason).toContain('"x":1');
  });

  it('evaluate 返回 deny 时原样透传', async () => {
    const r = new ToolRegistry();
    r.register({
      toolId: 'deny-tool',
      evaluate: async () => ({ verdict: 'deny', ruleId: 'deny.rule', code: 'DENIED', reason: 'reason' }),
    });
    const res = await r.evaluateGate('deny-tool', {});
    expect(res.verdict).toBe('deny');
    expect(res.code).toBe('DENIED');
  });
});

describe('ToolRegistry — Capability enforcement（manifest）', () => {
  it('networkEgress=deny 阻止 requiresNetworkEgress=true 的工具', async () => {
    const r = new ToolRegistry();
    r.register({
      toolId: 'net-tool',
      requiresNetworkEgress: true,
      evaluate: async () => ({ verdict: 'allow', ruleId: 'net.allow' }),
    });
    const res = await r.evaluateGate('net-tool', {}, { manifest: makeManifest({ networkEgress: 'deny' }) });
    expect(res.verdict).toBe('deny');
    expect(res.code).toBe('CAPABILITY_NETWORK_EGRESS_DENIED');
  });

  it('networkEgress=allowlist 不阻止 requiresNetworkEgress=true 的工具', async () => {
    const r = new ToolRegistry();
    r.register({
      toolId: 'net-tool',
      requiresNetworkEgress: true,
      evaluate: async () => ({ verdict: 'allow', ruleId: 'net.allow' }),
    });
    const res = await r.evaluateGate('net-tool', {}, { manifest: makeManifest({ networkEgress: 'allowlist' }) });
    expect(res.verdict).toBe('allow');
  });

  it('requiresNetworkEgress=false 的工具不受 networkEgress=deny 影响', async () => {
    const r = new ToolRegistry();
    r.register({
      toolId: 'local-tool',
      requiresNetworkEgress: false,
      evaluate: async () => ({ verdict: 'allow', ruleId: 'local.allow' }),
    });
    const res = await r.evaluateGate('local-tool', {}, { manifest: makeManifest({ networkEgress: 'deny' }) });
    expect(res.verdict).toBe('allow');
  });

  it('thirdPartyAPI=false 阻止 requiresThirdPartyAPI=true 的工具', async () => {
    const r = new ToolRegistry();
    r.register({
      toolId: 'ext-tool',
      requiresThirdPartyAPI: true,
      evaluate: async () => ({ verdict: 'allow', ruleId: 'ext.allow' }),
    });
    const res = await r.evaluateGate('ext-tool', {}, { manifest: makeManifest({ thirdPartyAPI: false }) });
    expect(res.verdict).toBe('deny');
    expect(res.code).toBe('CAPABILITY_THIRD_PARTY_API_DENIED');
  });

  it('thirdPartyAPI=true 允许 requiresThirdPartyAPI=true 的工具', async () => {
    const r = new ToolRegistry();
    r.register({
      toolId: 'ext-tool',
      requiresThirdPartyAPI: true,
      evaluate: async () => ({ verdict: 'allow', ruleId: 'ext.allow' }),
    });
    const res = await r.evaluateGate('ext-tool', {}, { manifest: makeManifest({ thirdPartyAPI: true, networkEgress: 'allowlist' }) });
    expect(res.verdict).toBe('allow');
  });

  it('未提供 manifest 时不执行 capability 检查', async () => {
    const r = new ToolRegistry();
    r.register({
      toolId: 'any-tool',
      requiresNetworkEgress: true,
      requiresThirdPartyAPI: true,
      evaluate: async () => ({ verdict: 'allow', ruleId: 'any.allow' }),
    });
    // no manifest → no capability gate
    const res = await r.evaluateGate('any-tool', {});
    expect(res.verdict).toBe('allow');
  });
});

describe('ToolRegistry — getRequirements', () => {
  it('未注册工具返回 undefined', () => {
    const r = new ToolRegistry();
    expect(r.getRequirements('ghost')).toBeUndefined();
  });

  it('已注册工具返回声明的 requirements', () => {
    const r = new ToolRegistry();
    r.register({ toolId: 'rt', requiresNetworkEgress: true, requiresThirdPartyAPI: false, evaluate: async () => ({ verdict: 'allow', ruleId: 'rt' } as ToolGateResult) });
    const reqs = r.getRequirements('rt');
    expect(reqs?.requiresNetworkEgress).toBe(true);
    expect(reqs?.requiresThirdPartyAPI).toBe(false);
  });
});
