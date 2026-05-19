import type {
  ApiResponse,
  FinancialExportAuditRequest,
  FinancialExportAuditResponse,
  ExecutionStartRequest,
  ExecutionStartResponse,
  ExecutionStateUpdateRequest,
  ExecutionStateUpdateResponse,
  IngressIngestRequest,
  IngressIngestResponse,
  PolicyCurrentRequest,
  PolicyCurrentResponse,
  FinancialExportAuditQueryRequest,
  FinancialExportAuditQueryResponse,
} from './types';
import { resolveBackendContractMode, type BackendContractMode } from './mode';
import { validateFinancialExportAuditRequest } from './validateFinancialExportAuditRequest';

export interface BackendContractClient {
  ingestEvents(req: IngressIngestRequest): Promise<ApiResponse<IngressIngestResponse>>;
  startExecution(req: ExecutionStartRequest): Promise<ApiResponse<ExecutionStartResponse>>;
  updateExecutionState(
    req: ExecutionStateUpdateRequest
  ): Promise<ApiResponse<ExecutionStateUpdateResponse>>;
  getCurrentPolicy(req: PolicyCurrentRequest): Promise<ApiResponse<PolicyCurrentResponse>>;
  auditFinancialExport(
    req: FinancialExportAuditRequest
  ): Promise<ApiResponse<FinancialExportAuditResponse>>;
  queryFinancialExportAudit(
    req: FinancialExportAuditQueryRequest
  ): Promise<ApiResponse<FinancialExportAuditQueryResponse>>;
}

interface BackendClientFactoryOptions {
  mode?: BackendContractMode;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
}

export interface BackendContractRuntimeInfo {
  mode: BackendContractMode;
  baseUrl: string;
  timeoutMs: number;
  retries: number;
}

function traceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readNumber(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toApiError(code: string, message: string): ApiResponse<never> {
  return { ok: false, traceId: traceId(), error: { code, message } };
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Stub：`auditFinancialExport` 幂等缓存（按 exportSessionId 优先，否则 exportBatchId） */
const stubFinancialExportAuditCache = new Map<
  string,
  { traceId: string; receivedAt: string; req: FinancialExportAuditRequest }
>();

export function clearStubFinancialExportAuditIdempotencyCache(): void {
  stubFinancialExportAuditCache.clear();
}

function financialExportAuditIdempotencyKey(req: FinancialExportAuditRequest): string {
  const sid = req.exportSessionId?.trim();
  if (sid) {
    return `sess:${sid}`;
  }
  return `batch:${req.exportBatchId}`;
}

export function createStubBackendContractClient(): BackendContractClient {
  return {
    async ingestEvents(req) {
      const accepted = Array.isArray(req.events) ? req.events.length : 0;
      return { ok: true, traceId: traceId(), data: { accepted } };
    },
    async startExecution(_req) {
      return {
        ok: true,
        traceId: traceId(),
        data: { executionId: `exec_${Date.now()}`, status: 'queued' },
      };
    },
    async updateExecutionState(req) {
      return { ok: true, traceId: traceId(), data: { status: req.status } };
    },
    async getCurrentPolicy(req) {
      return {
        ok: true,
        traceId: traceId(),
        data: {
          policy: {
            schemaVersion: 1,
            version: 'stub-v1',
            publishedAt: new Date().toISOString(),
            flags: {
              enableDevWorkspace: req.context.appProfile !== 'mobile-lite',
              /** 财务导出总闸；false 时 evaluatePolicy 在矩阵之前拒绝 */
              enableFinancialExport: true,
            },
            thresholds: { riskBudget: 1 },
            weights: { templateBoost: 1 },
          },
        },
      };
    },
    async auditFinancialExport(req) {
      const v = validateFinancialExportAuditRequest(req);
      if (!v.valid) {
        return { ok: false, traceId: traceId(), error: { code: v.code, message: v.message } };
      }
      const key = financialExportAuditIdempotencyKey(req);
      const hit = stubFinancialExportAuditCache.get(key);
      if (hit) {
        return {
          ok: true,
          traceId: hit.traceId,
          data: { accepted: true, receivedAt: hit.receivedAt },
        };
      }
      const receivedAt = new Date().toISOString();
      const tid = traceId();
      stubFinancialExportAuditCache.set(key, { traceId: tid, receivedAt, req });
      return {
        ok: true,
        traceId: tid,
        data: { accepted: true, receivedAt },
      };
    },
    async queryFinancialExportAudit(req) {
      const items = Array.from(stubFinancialExportAuditCache.values())
        .map((entry) => ({
          exportSessionId: entry.req.exportSessionId || '',
          exportBatchId: entry.req.exportBatchId,
          csvSha256: entry.req.csvSha256,
          actorType: entry.req.actorType,
          actorId: entry.req.actorId,
          purpose: entry.req.purpose,
          scope: entry.req.scope,
          dataDomain: entry.req.dataDomain,
          dataSensitivity: entry.req.dataSensitivity,
          rowCount: entry.req.rowCount,
          occurredAt: entry.req.occurredAt,
          receivedAt: entry.receivedAt,
          traceId: entry.traceId,
        }))
        .filter((item) => {
          if (req.sessionId && item.exportSessionId !== req.sessionId) return false;
          if (req.batchId && item.exportBatchId !== req.batchId) return false;
          if (req.actorId && item.actorId !== req.actorId) return false;
          return true;
        });
      return {
        ok: true,
        traceId: traceId(),
        data: { items },
      };
    },
  };
}

function createHttpBackendContractClient(
  baseUrl: string,
  options: { timeoutMs: number; retries: number }
): BackendContractClient {
  const root = baseUrl.replace(/\/+$/, '');
  const post = async <T>(
    path: string,
    body: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> => {
    for (let attempt = 0; attempt <= options.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const resp = await fetch(`${root}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...extraHeaders },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!resp.ok) {
          const msg = `HTTP ${resp.status} ${resp.statusText || ''}`.trim();
          if (attempt < options.retries && isRetryableStatus(resp.status)) {
            await sleep(200 * (attempt + 1));
            continue;
          }
          return toApiError('HTTP_ERROR', msg);
        }
        const json = (await resp.json()) as ApiResponse<T>;
        return json;
      } catch (e) {
        clearTimeout(timer);
        const timeout = e instanceof DOMException && e.name === 'AbortError';
        const code = timeout ? 'TIMEOUT' : 'NETWORK_ERROR';
        const msg = timeout
          ? `Request timeout after ${options.timeoutMs}ms`
          : e instanceof Error
            ? e.message
            : 'network error';
        if (attempt < options.retries) {
          await sleep(200 * (attempt + 1));
          continue;
        }
        return toApiError(code, msg);
      }
    }
    return toApiError('UNKNOWN', 'Unexpected request failure');
  };

  const get = async <T>(
    path: string,
    params?: Record<string, string | undefined>
  ): Promise<ApiResponse<T>> => {
    const url = new URL(`${root}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) url.searchParams.set(k, v);
      }
    }
    for (let attempt = 0; attempt <= options.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const resp = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!resp.ok) {
          const msg = `HTTP ${resp.status} ${resp.statusText || ''}`.trim();
          if (attempt < options.retries && isRetryableStatus(resp.status)) {
            await sleep(200 * (attempt + 1));
            continue;
          }
          return toApiError('HTTP_ERROR', msg);
        }
        return (await resp.json()) as ApiResponse<T>;
      } catch (e) {
        clearTimeout(timer);
        const timeout = e instanceof DOMException && e.name === 'AbortError';
        const code = timeout ? 'TIMEOUT' : 'NETWORK_ERROR';
        const msg = timeout
          ? `Request timeout after ${options.timeoutMs}ms`
          : e instanceof Error
            ? e.message
            : 'network error';
        if (attempt < options.retries) {
          await sleep(200 * (attempt + 1));
          continue;
        }
        return toApiError(code, msg);
      }
    }
    return toApiError('UNKNOWN', 'Unexpected request failure');
  };
  return {
    ingestEvents: (req) => post<IngressIngestResponse>('/api/events/ingest', req),
    startExecution: (req) => post<ExecutionStartResponse>('/api/executions/start', req),
    updateExecutionState: (req) => post<ExecutionStateUpdateResponse>('/api/executions/state', req),
    getCurrentPolicy: (req) => post<PolicyCurrentResponse>('/api/policy/current', req),
    auditFinancialExport: (req) => {
      const v = validateFinancialExportAuditRequest(req);
      if (!v.valid) {
        return Promise.resolve({ ok: false, traceId: traceId(), error: { code: v.code, message: v.message } });
      }
      const key = req.exportSessionId?.trim() || req.exportBatchId;
      return post<FinancialExportAuditResponse>('/api/finance/export/audit', req, {
        'X-Idempotency-Key': key,
      });
    },
    queryFinancialExportAudit: (req) => {
      const params: Record<string, string | undefined> = {
        sessionId: req.sessionId,
        batchId: req.batchId,
        actorId: req.actorId,
      };
      return get<FinancialExportAuditQueryResponse>('/api/finance/export/audit', params);
    },
  };
}

export function getBackendContractRuntimeInfo(
  options: BackendClientFactoryOptions = {}
): BackendContractRuntimeInfo {
  const mode = options.mode ?? resolveBackendContractMode(import.meta.env.VITE_BACKEND_CONTRACT_MODE);
  const baseUrl = String(options.baseUrl ?? import.meta.env.VITE_BACKEND_BASE_URL ?? '').trim();
  const timeoutMs = readNumber(options.timeoutMs ?? import.meta.env.VITE_BACKEND_HTTP_TIMEOUT_MS, 5000);
  const retries = readNumber(options.retries ?? import.meta.env.VITE_BACKEND_HTTP_RETRIES, 1);
  return { mode, baseUrl, timeoutMs, retries };
}

export function createBackendContractClient(
  options: BackendClientFactoryOptions = {}
): BackendContractClient {
  const runtime = getBackendContractRuntimeInfo(options);
  const mode = runtime.mode;
  if (mode === 'http') {
    if (runtime.baseUrl) {
      return createHttpBackendContractClient(runtime.baseUrl, {
        timeoutMs: runtime.timeoutMs,
        retries: runtime.retries,
      });
    }
  }
  return createStubBackendContractClient();
}

