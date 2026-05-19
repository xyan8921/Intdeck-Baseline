/**
 * RemoteExecutionBackend（Sprint E 增强）：
 * Sprint D 基础：fetch POST + Bearer auth + AbortController 超时。
 * Sprint E 新增：X-Request-ID 追踪头、网络错误自动重试（maxRetries）。
 */

function defaultRequestIdFactory(): string {
  return `reqid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface RemoteExecutionBackendConfig {
  /** 必须以 https:// 开头的远端执行节点地址 */
  endpoint: string;
  /** Bearer token（可选） */
  authToken?: string;
  /** 请求超时（ms），默认 30000 */
  timeoutMs?: number;
  /**
   * Sprint E：X-Request-ID 值生成器；默认内置生成器（reqid-{timestamp}-{random}）。
   * 测试时可注入固定值工厂以断言请求头。
   */
  requestIdFactory?: () => string;
  /**
   * Sprint E：网络错误（抛出异常）时的最大重试次数；默认 0（不重试）。
   * HTTP 4xx/5xx 不重试。每次重试使用独立 AbortController。
   */
  maxRetries?: number;
}

export interface RemoteBackendResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface RemoteBackendClient {
  execute<T = unknown>(payload: unknown): Promise<RemoteBackendResponse<T>>;
}

export interface RemoteBackendConfigValidation {
  valid: boolean;
  errors: string[];
}

/**
 * 校验 RemoteExecutionBackendConfig 合法性（纯静态，无网络）。
 */
export function validateRemoteBackendConfig(
  config: RemoteExecutionBackendConfig
): RemoteBackendConfigValidation {
  const errors: string[] = [];

  if (!config.endpoint?.trim()) {
    errors.push('endpoint 不能为空');
  } else if (!config.endpoint.startsWith('https://')) {
    errors.push('endpoint 必须以 https:// 开头（明文 http 不允许）');
  } else {
    try {
      new URL(config.endpoint);
    } catch {
      errors.push(`endpoint 不是合法 URL：${config.endpoint}`);
    }
  }

  if (config.authToken !== undefined && config.authToken.trim().length === 0) {
    errors.push('authToken 若提供则不能为空字符串');
  }

  if (config.timeoutMs !== undefined) {
    if (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0) {
      errors.push('timeoutMs 必须为正整数');
    }
  }

  if (config.maxRetries !== undefined) {
    if (!Number.isInteger(config.maxRetries) || config.maxRetries < 0) {
      errors.push('maxRetries 必须为非负整数');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 创建 remote 后端客户端（Sprint E 增强）。
 * POST JSON payload，Bearer auth，X-Request-ID 追踪头，AbortController 超时，
 * 网络错误自动重试（maxRetries 次），HTTP 错误不重试。
 */
export function createRemoteBackendClient(config: RemoteExecutionBackendConfig): RemoteBackendClient {
  const validation = validateRemoteBackendConfig(config);
  if (!validation.valid) {
    throw new Error(
      `RemoteExecutionBackendConfig 校验失败：${validation.errors.join('; ')}`
    );
  }

  const timeoutMs = config.timeoutMs ?? 30_000;
  const maxRetries = config.maxRetries ?? 0;
  const makeRequestId = config.requestIdFactory ?? defaultRequestIdFactory;

  return {
    async execute<T>(payload: unknown): Promise<RemoteBackendResponse<T>> {
      const requestId = makeRequestId();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
      };

      let lastError = '';

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(config.endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            // HTTP 错误不重试
            return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
          }

          const data = (await response.json()) as T;
          return { ok: true, data };
        } catch (e) {
          clearTimeout(timer);
          lastError = e instanceof Error ? e.message : String(e);
          // 网络错误：若还有重试次数则继续
          if (attempt < maxRetries) continue;
        }
      }

      return { ok: false, error: lastError };
    },
  };
}
