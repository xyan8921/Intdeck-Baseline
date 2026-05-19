import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LLM_ROUTING_TABLE,
  selectLlmRoute,
  type LlmRoutingProfile,
} from './llmRouter';

const CAPS_OFF = { llm: false, thirdPartyAPI: false };
const CAPS_LLM_ONLY = { llm: true, thirdPartyAPI: false };
const CAPS_FULL = { llm: true, thirdPartyAPI: true };

describe('selectLlmRoute — llm=false', () => {
  it('capabilities.llm=false → null', () => {
    expect(selectLlmRoute({ capabilities: CAPS_OFF })).toBeNull();
    expect(selectLlmRoute({ capabilities: { llm: false, thirdPartyAPI: true } })).toBeNull();
  });
});

describe('selectLlmRoute — 默认路由表', () => {
  it('llm=true thirdPartyAPI=false → mock（唯一满足条件）', () => {
    const d = selectLlmRoute({ capabilities: CAPS_LLM_ONLY });
    expect(d).not.toBeNull();
    expect(d!.provider).toBe('mock');
    expect(d!.model).toBe('mock-model');
  });

  it('llm=true thirdPartyAPI=true → anthropic（最高优先级）', () => {
    const d = selectLlmRoute({ capabilities: CAPS_FULL });
    expect(d!.provider).toBe('anthropic');
    expect(d!.model).toBe('claude-sonnet-4-6');
  });

  it('rationale 字符串包含 provider/model 与能力信息', () => {
    const d = selectLlmRoute({ capabilities: CAPS_FULL });
    expect(d!.rationale).toContain('anthropic');
    expect(d!.rationale).toContain('thirdPartyAPI=true');
  });
});

describe('selectLlmRoute — preferredProvider', () => {
  it('preferredProvider=openai + thirdPartyAPI=true → openai', () => {
    const d = selectLlmRoute({ capabilities: CAPS_FULL, preferredProvider: 'openai' });
    expect(d!.provider).toBe('openai');
  });

  it('preferredProvider=anthropic + thirdPartyAPI=false → 降级 mock，rationale 含 fallback', () => {
    const d = selectLlmRoute({ capabilities: CAPS_LLM_ONLY, preferredProvider: 'anthropic' });
    expect(d!.provider).toBe('mock');
    expect(d!.rationale).toContain('fallback');
  });

  it('preferredProvider=mock → mock 即使 thirdPartyAPI=true', () => {
    const d = selectLlmRoute({ capabilities: CAPS_FULL, preferredProvider: 'mock' });
    expect(d!.provider).toBe('mock');
  });
});

describe('selectLlmRoute — 自定义路由表', () => {
  const custom: LlmRoutingProfile[] = [
    { provider: 'openai', model: 'gpt-4-turbo', requiresThirdParty: true },
    { provider: 'mock', model: 'my-mock', requiresThirdParty: false },
  ];

  it('使用自定义路由表选路', () => {
    const d = selectLlmRoute({ capabilities: CAPS_FULL, routingTable: custom });
    expect(d!.provider).toBe('openai');
    expect(d!.model).toBe('gpt-4-turbo');
  });

  it('全部候选不满足 → null（无 mock 兜底时）', () => {
    const strict: LlmRoutingProfile[] = [
      { provider: 'anthropic', model: 'claude', requiresThirdParty: true },
    ];
    const d = selectLlmRoute({ capabilities: CAPS_LLM_ONLY, routingTable: strict });
    expect(d).toBeNull();
  });
});

describe('DEFAULT_LLM_ROUTING_TABLE', () => {
  it('包含 mock 兜底条目（requiresThirdParty=false）', () => {
    const mock = DEFAULT_LLM_ROUTING_TABLE.find((p) => p.provider === 'mock');
    expect(mock).toBeDefined();
    expect(mock!.requiresThirdParty).toBe(false);
  });

  it('anthropic 排在 openai 之前', () => {
    const aIdx = DEFAULT_LLM_ROUTING_TABLE.findIndex((p) => p.provider === 'anthropic');
    const oIdx = DEFAULT_LLM_ROUTING_TABLE.findIndex((p) => p.provider === 'openai');
    expect(aIdx).toBeLessThan(oIdx);
  });
});
