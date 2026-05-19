/**
 * Intent 记录版本与 meta 软迁移（IndexedDB 无结构破坏，读时规范化）
 * @see INTDONE_TECH_PLAN_v1 §2.2.1
 */

import type { Intent } from './types';

/** 当前推荐记录版本（keywordBundle 与 recordVersion 语义） */
export const INTENT_RECORD_VERSION = 2;

function coerceDate(d: Date | string | unknown): Date {
  if (d instanceof Date) return d;
  if (typeof d === 'string' || typeof d === 'number') return new Date(d);
  return new Date();
}

/**
 * 读库后调用：补齐 recordVersion、日期类型、从 aiKeywords 补 keywordBundle（仅缺省时）
 */
export function normalizeIntent(raw: Intent): Intent {
  const createdAt = coerceDate(raw.createdAt);
  const updatedAt = coerceDate(raw.updatedAt);
  const recordVersion = raw.recordVersion ?? 1;

  let meta = raw.meta;
  if (meta && recordVersion < 2) {
    const m = meta as Record<string, unknown>;
    const kw = m.aiKeywords;
    if (!m.keywordBundle && Array.isArray(kw) && kw.length > 0) {
      meta = {
        ...meta,
        keywordBundle: {
          schemaVersion: '0' as const,
          entries: kw.map((text: unknown, i: number) => ({
            key: `kw_${i}`,
            value: String(text),
            source: 'core-ai' as const,
          })),
        },
      } as Intent['meta'];
    }
  }

  return {
    ...raw,
    createdAt,
    updatedAt,
    meta,
    recordVersion: Math.max(recordVersion, INTENT_RECORD_VERSION),
  };
}

/** 写入前调用：保证带 recordVersion */
export function stampIntentForSave(intent: Intent): Intent {
  return {
    ...intent,
    recordVersion: INTENT_RECORD_VERSION,
    updatedAt: new Date(),
  };
}
