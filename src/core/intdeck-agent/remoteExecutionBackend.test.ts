import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRemoteBackendClient,
  validateRemoteBackendConfig,
  type RemoteExecutionBackendConfig,
} from './remoteExecutionBackend';

// ── validateRemoteBackendConfig ───────────────────────────────────────────────

describe('validateRemoteBackendConfig', () => {
  it('合法最小配置 → valid=true', () => {
    expect(validateRemoteBackendConfig({ endpoint: 'https://api.example.com/exec' }).valid).toBe(true);
  });

  it('合法完整配置 → valid=true', () => {
    const r = validateRemoteBackendConfig({
      endpoint: 'https://exec.intdone.internal',
      authToken: 'tok_abc123',
      timeoutMs: 15000,
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('空 endpoint → 错误', () => {
    const r = validateRemoteBackendConfig({ endpoint: '' });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('endpoint'))).toBe(true);
  });

  it('http:// endpoint → 错误', () => {
    const r = validateRemoteBackendConfig({ endpoint: 'http://api.example.com' });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('https://'))).toBe(true);
  });

  it('非法 URL → 错误', () => {
    expect(validateRemoteBackendConfig({ endpoint: 'https://not a valid url!!' }).valid).toBe(false);
  });

  it('authToken 空字符串 → 错误', () => {
    const r = validateRemoteBackendConfig({ endpoint: 'https://ok.example.com', authToken: '   ' });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('authToken'))).toBe(true);
  });

  it('timeoutMs ≤ 0 → 错误', () => {
    expect(validateRemoteBackendConfig({ endpoint: 'https://ok.example.com', timeoutMs: 0 }).valid).toBe(false);
    expect(validateRemoteBackendConfig({ endpoint: 'https://ok.example.com', timeoutMs: -1 }).valid).toBe(false);
  });

  it('timeoutMs 非整数 → 错误', () => {
    expect(validateRemoteBackendConfig({ endpoint: 'https://ok.example.com', timeoutMs: 1.5 }).valid).toBe(false);
  });

  it('timeoutMs=1000 → valid', () => {
    expect(validateRemoteBackendConfig({ endpoint: 'https://ok.example.com', timeoutMs: 1000 }).valid).toBe(true);
  });
});

// ── createRemoteBackendClient — 配置校验 ─────────────────────────────────────

describe('createRemoteBackendClient — 配置校验', () => {
  it('合法配置 → 返回 client', () => {
    const client = createRemoteBackendClient({ endpoint: 'https://exec.example.com' });
    expect(typeof client.execute).toBe('function');
  });

  it('非法配置 → 抛错', () => {
    expect(() => createRemoteBackendClient({ endpoint: 'http://not-secure.com' })).toThrow(/校验失败/);
  });
});

// ── createRemoteBackendClient — HTTP 行为（fetch mock）────────────────────────

const VALID_CONFIG: RemoteExecutionBackendConfig = {
  endpoint: 'https://exec.intdone.internal/run',
  authToken: 'tok_test',
  timeoutMs: 5000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(response: { ok: boolean; status?: number; body?: unknown; throws?: Error }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (response.throws) throw response.throws;
      return {
        ok: response.ok,
        status: response.status ?? (response.ok ? 200 : 500),
        json: async () => response.body,
        text: async () => (typeof response.body === 'string' ? response.body : JSON.stringify(response.body)),
      };
    })
  );
}

describe('createRemoteBackendClient — HTTP fetch（Sprint D）', () => {
  it('成功路径：ok=true, data 包含响应体', async () => {
    mockFetch({ ok: true, body: { result: 'done', taskId: '42' } });
    const client = createRemoteBackendClient(VALID_CONFIG);
    const res = await client.execute<{ result: string }>({ action: 'test' });
    expect(res.ok).toBe(true);
    expect(res.data?.result).toBe('done');
  });

  it('POST 请求带 Content-Type: application/json', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createRemoteBackendClient(VALID_CONFIG);
    await client.execute({ x: 1 });

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('authToken 注入 Authorization 头', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createRemoteBackendClient(VALID_CONFIG);
    await client.execute({});

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok_test');
  });

  it('无 authToken 时不发送 Authorization 头', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createRemoteBackendClient({ endpoint: 'https://anon.example.com' });
    await client.execute({});

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('HTTP 5xx → ok=false, error 含状态码', async () => {
    mockFetch({ ok: false, status: 503, body: 'Service Unavailable' });
    const client = createRemoteBackendClient(VALID_CONFIG);
    const res = await client.execute({});
    expect(res.ok).toBe(false);
    expect(res.error).toContain('503');
  });

  it('网络错误 → ok=false, error 含异常消息', async () => {
    mockFetch({ ok: false, throws: new Error('network failure') });
    const client = createRemoteBackendClient(VALID_CONFIG);
    const res = await client.execute({});
    expect(res.ok).toBe(false);
    expect(res.error).toContain('network failure');
  });

  it('payload 序列化为 JSON body', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createRemoteBackendClient(VALID_CONFIG);
    await client.execute({ task: 'run', args: [1, 2] });

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ task: 'run', args: [1, 2] });
  });
});

// ── X-Request-ID（Sprint E）──────────────────────────────────────────────────

describe('createRemoteBackendClient — X-Request-ID（Sprint E）', () => {
  it('每次请求注入 X-Request-ID 头', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({}), text: async () => '{}',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createRemoteBackendClient(VALID_CONFIG);
    await client.execute({});

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(typeof headers['X-Request-ID']).toBe('string');
    expect(headers['X-Request-ID'].length).toBeGreaterThan(0);
  });

  it('自定义 requestIdFactory 注入固定值', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({}), text: async () => '{}',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = createRemoteBackendClient({
      ...VALID_CONFIG,
      requestIdFactory: () => 'fixed-req-id-001',
    });
    await client.execute({});

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Request-ID']).toBe('fixed-req-id-001');
  });

  it('两次独立 execute 调用各自生成不同 requestId', async () => {
    const capturedIds: string[] = [];
    const fetchSpy = vi.fn(async (_url: unknown, init: unknown) => {
      const h = (init as RequestInit).headers as Record<string, string>;
      capturedIds.push(h['X-Request-ID']);
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const client = createRemoteBackendClient(VALID_CONFIG);
    await client.execute({});
    await client.execute({});

    expect(capturedIds).toHaveLength(2);
    expect(capturedIds[0]).not.toBe(capturedIds[1]);
  });
});

// ── 重试（Sprint E）──────────────────────────────────────────────────────────

describe('createRemoteBackendClient — 重试（Sprint E）', () => {
  it('maxRetries=0（默认）：网络错误不重试，直接返回 error', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount++;
      throw new Error('network down');
    }));

    const client = createRemoteBackendClient(VALID_CONFIG);
    const res = await client.execute({});

    expect(res.ok).toBe(false);
    expect(res.error).toContain('network down');
    expect(callCount).toBe(1);
  });

  it('maxRetries=2：前两次网络错误，第 3 次成功', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount++;
      if (callCount < 3) throw new Error(`attempt ${callCount} failed`);
      return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => '{}' };
    }));

    const client = createRemoteBackendClient({ ...VALID_CONFIG, maxRetries: 2 });
    const res = await client.execute({});

    expect(res.ok).toBe(true);
    expect((res.data as { success: boolean }).success).toBe(true);
    expect(callCount).toBe(3);
  });

  it('maxRetries=3：全部失败，返回最后一次错误', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount++;
      throw new Error(`attempt ${callCount}`);
    }));

    const client = createRemoteBackendClient({ ...VALID_CONFIG, maxRetries: 3 });
    const res = await client.execute({});

    expect(res.ok).toBe(false);
    expect(res.error).toContain('attempt 4');
    expect(callCount).toBe(4); // 1 初始 + 3 重试
  });

  it('HTTP 5xx 不重试', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount++;
      return { ok: false, status: 503, json: async () => ({}), text: async () => 'overloaded' };
    }));

    const client = createRemoteBackendClient({ ...VALID_CONFIG, maxRetries: 3 });
    const res = await client.execute({});

    expect(res.ok).toBe(false);
    expect(res.error).toContain('503');
    expect(callCount).toBe(1); // HTTP 错误不重试
  });
});

// ── validateRemoteBackendConfig — maxRetries 校验（Sprint E）─────────────────

describe('validateRemoteBackendConfig — maxRetries（Sprint E）', () => {
  it('maxRetries=0 → valid', () => {
    expect(validateRemoteBackendConfig({ endpoint: 'https://ok.example.com', maxRetries: 0 }).valid).toBe(true);
  });

  it('maxRetries=5 → valid', () => {
    expect(validateRemoteBackendConfig({ endpoint: 'https://ok.example.com', maxRetries: 5 }).valid).toBe(true);
  });

  it('maxRetries=-1 → 错误', () => {
    const r = validateRemoteBackendConfig({ endpoint: 'https://ok.example.com', maxRetries: -1 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('maxRetries'))).toBe(true);
  });

  it('maxRetries=1.5 → 错误', () => {
    expect(validateRemoteBackendConfig({ endpoint: 'https://ok.example.com', maxRetries: 1.5 }).valid).toBe(false);
  });
});
