import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  renderEvidenceSummaryMarkdownV1,
  type GatesSummaryV1,
} from './evidenceSummaryMarkdown';
import type { ReplayResultsJsonV1 } from './replaySummaryMarkdown';

export type EvidenceFileEntryV1 = {
  path: string;
  sha256Hex: string | null;
  bytes: number | null;
};

export type EvidenceRepoInfoV1 = {
  commitSha: string | null;
  branch: string | null;
  isDirty: boolean | null;
};

export type EvidenceRuntimeInfoV1 = {
  nodeVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  cwd: string;
  npmUserAgent: string | null;
};

export type EvidenceManifestV1 = {
  schemaVersion: 1;
  generatedAt: string;
  outDir: string;
  command: string;
  repo: EvidenceRepoInfoV1;
  runtime: EvidenceRuntimeInfoV1;
  config: {
    configPath: string | null;
    configSha256: string | null;
  };
  inputs: EvidenceFileEntryV1[];
  outputs: EvidenceFileEntryV1[];
  notes?: string[];
};

function sha256HexOfBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function sha256HexOfFileSync(path: string): { sha256Hex: string; bytes: number } {
  const abs = resolve(path);
  const buf = readFileSync(abs);
  return { sha256Hex: sha256HexOfBuffer(buf), bytes: buf.byteLength };
}

export function buildEvidenceFileEntryV1(path: string): EvidenceFileEntryV1 {
  const abs = resolve(path);
  if (!existsSync(abs)) return { path, sha256Hex: null, bytes: null };
  const st = statSync(abs);
  if (!st.isFile()) return { path, sha256Hex: null, bytes: null };
  const { sha256Hex, bytes } = sha256HexOfFileSync(abs);
  return { path, sha256Hex, bytes };
}

export function buildRuntimeInfoV1(): EvidenceRuntimeInfoV1 {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    npmUserAgent: process.env.npm_config_user_agent ?? null,
  };
}

export function tryReadRepoInfoV1(): EvidenceRepoInfoV1 {
  try {
    const commitSha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
    return { commitSha: commitSha || null, branch: branch || null, isDirty: dirty.length > 0 };
  } catch {
    return { commitSha: null, branch: null, isDirty: null };
  }
}

const EVIDENCE_OUTPUT_BASENAMES = [
  'experience.export.json',
  'g0-reports.json',
  'gates.summary.json',
  'replay.results.json',
  'replay.summary.md',
  'evidence.manifest.json',
  'evidence.summary.md',
] as const;

export function finalizeEvidencePackV1(
  outDir: string,
  opts: {
    command: string;
    configPath?: string | null;
    configSha256: string | null;
    inputs?: string[];
    notes?: string[];
  }
): EvidenceManifestV1 {
  mkdirSync(outDir, { recursive: true });
  const outputPaths = EVIDENCE_OUTPUT_BASENAMES.map((name) => join(outDir, name));
  const manifest: EvidenceManifestV1 = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    outDir,
    command: opts.command,
    repo: tryReadRepoInfoV1(),
    runtime: buildRuntimeInfoV1(),
    config: { configPath: opts.configPath ?? null, configSha256: opts.configSha256 },
    inputs: (opts.inputs ?? []).map((p) => buildEvidenceFileEntryV1(p)),
    outputs: outputPaths.map((p) => buildEvidenceFileEntryV1(p)),
    notes: opts.notes,
  };

  const manifestPath = join(outDir, 'evidence.manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  let gates: GatesSummaryV1 | null = null;
  const gatesPath = join(outDir, 'gates.summary.json');
  if (existsSync(gatesPath)) {
    gates = JSON.parse(readFileSync(gatesPath, 'utf8')) as GatesSummaryV1;
  }

  let replaySummary: ReplayResultsJsonV1['summary'] | null = null;
  const replayPath = join(outDir, 'replay.results.json');
  if (existsSync(replayPath)) {
    const parsed = JSON.parse(readFileSync(replayPath, 'utf8')) as ReplayResultsJsonV1;
    replaySummary = parsed.summary;
  }

  writeFileSync(
    join(outDir, 'evidence.summary.md'),
    renderEvidenceSummaryMarkdownV1({ manifest, gates, replaySummary }),
    'utf8'
  );

  return manifest;
}

