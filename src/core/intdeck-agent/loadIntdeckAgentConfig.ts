import { readFileSync, existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { sha256HexOfUtf8TextCompat } from '../experience/sha256Compat';
import type { IntdeckAgentConfigFileV1, IntdeckAgentRuntimeManifestV1 } from '../experience/experienceTypes';

const DEFAULT_REL = 'config/intdeck-agent.default.json';

const EMBEDDED_DEFAULT = `{
  "schemaVersion": 1,
  "label": "embedded-default",
  "capabilities": {
    "llm": false,
    "thirdPartyAPI": false,
    "networkEgress": "deny"
  }
}`;

function parseConfigJson(raw: string, loadedFrom: string): IntdeckAgentConfigFileV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Intdeck Agent 配置 JSON 无效: ${loadedFrom}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Intdeck Agent 配置须为对象: ${loadedFrom}`);
  }
  const o = parsed as Record<string, unknown>;
  if (o.schemaVersion !== 1) {
    throw new Error(`Intdeck Agent 配置 schemaVersion 须为 1: ${loadedFrom}`);
  }
  const cap = o.capabilities as Record<string, unknown> | undefined;
  if (!cap || typeof cap !== 'object') {
    throw new Error(`Intdeck Agent 配置缺少 capabilities: ${loadedFrom}`);
  }
  if (typeof cap.llm !== 'boolean' || typeof cap.thirdPartyAPI !== 'boolean') {
    throw new Error(`Intdeck Agent capabilities.llm / thirdPartyAPI 须为 boolean: ${loadedFrom}`);
  }
  if (cap.networkEgress !== 'deny' && cap.networkEgress !== 'allowlist') {
    throw new Error(`Intdeck Agent capabilities.networkEgress 须为 deny | allowlist: ${loadedFrom}`);
  }
  return {
    schemaVersion: 1,
    label: typeof o.label === 'string' ? o.label : undefined,
    capabilities: {
      llm: cap.llm,
      thirdPartyAPI: cap.thirdPartyAPI,
      networkEgress: cap.networkEgress,
    },
  };
}

export interface LoadIntdeckAgentConfigOptions {
  /** 显式路径（CLI `--config=`），优先于环境变量与默认文件 */
  configPath?: string;
  cwd?: string;
}

/**
 * 加载只读能力声明，生成可写入 experience 导出 manifest 的运行时快照（R1-b）。
 * 解析顺序：`configPath` → `INTDECK_AGENT_CONFIG` → `cwd/config/intdeck-agent.default.json` → 内嵌默认（fail-closed）。
 */
export async function loadIntdeckAgentRuntimeManifest(
  options: LoadIntdeckAgentConfigOptions = {}
): Promise<{ manifest: IntdeckAgentRuntimeManifestV1; raw: string; file: IntdeckAgentConfigFileV1 }> {
  const cwd = options.cwd ?? process.cwd();
  let raw: string;
  let loadedFrom: string;

  const toAbs = (p: string) => (isAbsolute(p) ? p : resolve(cwd, p));

  if (options.configPath) {
    const abs = toAbs(options.configPath);
    raw = readFileSync(abs, 'utf8');
    loadedFrom = abs;
  } else if (process.env.INTDECK_AGENT_CONFIG) {
    const abs = toAbs(process.env.INTDECK_AGENT_CONFIG);
    raw = readFileSync(abs, 'utf8');
    loadedFrom = abs;
  } else {
    const def = resolve(cwd, DEFAULT_REL);
    if (existsSync(def)) {
      raw = readFileSync(def, 'utf8');
      loadedFrom = def;
    } else {
      raw = EMBEDDED_DEFAULT;
      loadedFrom = 'embedded:default';
    }
  }

  const file = parseConfigJson(raw, loadedFrom);
  const configSha256 = await sha256HexOfUtf8TextCompat(raw);
  const manifest: IntdeckAgentRuntimeManifestV1 = {
    schemaVersion: 1,
    loadedFrom,
    configSha256,
    label: file.label,
    capabilities: file.capabilities,
  };
  return { manifest, raw, file };
}
