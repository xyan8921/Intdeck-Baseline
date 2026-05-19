import type { AgentSessionV1 } from './agentSession';
import type { CapabilityDriftEntry } from '../experience/detectCapabilityDrift';

export interface ReplayResultsJsonV1 {
  summary: {
    ok: boolean;
    itemsReplayed: number;
    blocked: boolean;
    exportedAt: string | null;
    storedConfigSha256: string | null;
    currentConfigSha256: string;
    inputSource?: 'disk' | 'memory';
    exportPackagePath?: string | null;
    repo?: {
      commitSha: string | null;
      branch: string | null;
      isDirty: boolean | null;
    };
    runtime?: {
      nodeVersion: string;
      platform: NodeJS.Platform;
      arch: string;
    };
    failure?: {
      stage: 'read-input' | 'validate-input' | 'execute' | 'blocked';
      message: string;
    } | null;
    driftSummary: {
      total: number;
      regressionFields: string[];
      upgradeFields: string[];
    };
    note: string;
  };
  session: AgentSessionV1;
  results: Array<{
    experienceItemId: string;
    ok: boolean;
    reportId: string;
    outcome: string;
    failureStage?: 'read-input' | 'validate-input' | 'execute' | 'blocked' | null;
    failureMessage?: string | null;
    capabilityDrift?: CapabilityDriftEntry[];
  }>;
}

export interface ReplaySummaryMarkdownOptions {
  outDir?: string;
  command?: string;
  generatedAt?: string;
  files?: {
    replayResultsJson?: string;
    replaySummaryMd?: string;
    experienceExportJson?: string;
    g0ReportsJson?: string;
  };
}

function shortSha(sha: string | null | undefined): string {
  if (!sha) return 'null';
  if (sha.length <= 12) return sha;
  return `${sha.slice(0, 12)}…`;
}

function joinFields(xs: string[]): string {
  return xs.length ? xs.join(', ') : '(none)';
}

function indentLines(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function renderDriftDetails(drifts: CapabilityDriftEntry[]): string {
  if (!drifts.length) return '- (none)\n';
  const lines: string[] = [];
  for (const d of drifts) {
    lines.push(`- **${d.severity}** \`${d.field}\`: ${d.description}`);
  }
  return `${lines.join('\n')}\n`;
}

export function renderReplaySummaryMarkdownV1(
  payload: ReplayResultsJsonV1,
  options?: ReplaySummaryMarkdownOptions
): string {
  const { summary, results } = payload;
  const lines: string[] = [];

  lines.push('# Intdeck Agent replay summary');
  lines.push('');
  if (options?.generatedAt) lines.push(`- generatedAt: \`${options.generatedAt}\``);
  if (options?.command) lines.push(`- command: \`${options.command}\``);
  lines.push('');
  lines.push(`- ok: **${summary.ok ? 'true' : 'false'}**`);
  lines.push(`- itemsReplayed: **${summary.itemsReplayed}**`);
  lines.push(`- blocked: **${summary.blocked ? 'true' : 'false'}**`);
  lines.push(`- exportedAt: \`${summary.exportedAt ?? 'null'}\``);
  if (summary.inputSource) lines.push(`- inputSource: \`${summary.inputSource}\``);
  if (summary.exportPackagePath !== undefined) {
    lines.push(`- exportPackagePath: \`${summary.exportPackagePath ?? 'null'}\``);
  }
  if (summary.runtime) {
    lines.push(
      `- runtime: node=\`${summary.runtime.nodeVersion}\`, platform=\`${summary.runtime.platform}\`, arch=\`${summary.runtime.arch}\``
    );
  }
  if (summary.repo) {
    lines.push(
      `- repo: commit=\`${shortSha(summary.repo.commitSha)}\`, branch=\`${summary.repo.branch ?? 'null'}\`, dirty=\`${summary.repo.isDirty ?? 'null'}\``
    );
  }
  lines.push(
    `- configSha256: stored=\`${shortSha(summary.storedConfigSha256)}\`, current=\`${shortSha(
      summary.currentConfigSha256
    )}\``
  );
  lines.push(
    `- driftSummary: total=${summary.driftSummary.total}, regressions=${joinFields(
      summary.driftSummary.regressionFields
    )}, upgrades=${joinFields(summary.driftSummary.upgradeFields)}`
  );
  if (summary.failure) {
    lines.push(`- failure: stage=\`${summary.failure.stage}\`, message=\`${summary.failure.message}\``);
  }
  if (summary.driftSummary.regressionFields.length) {
    lines.push(`- regressionFields: \`${summary.driftSummary.regressionFields.join('`, `')}\``);
  }
  if (summary.driftSummary.upgradeFields.length) {
    lines.push(`- upgradeFields: \`${summary.driftSummary.upgradeFields.join('`, `')}\``);
  }
  lines.push('');

  const files = options?.files;
  if (
    options?.outDir ||
    files?.replayResultsJson ||
    files?.replaySummaryMd ||
    files?.experienceExportJson ||
    files?.g0ReportsJson
  ) {
    lines.push('## Files');
    lines.push('');
    if (options?.outDir) lines.push(`- outDir: \`${options.outDir}\``);
    if (files?.replayResultsJson) lines.push(`- replay.results.json: \`${files.replayResultsJson}\``);
    if (files?.replaySummaryMd) lines.push(`- replay.summary.md: \`${files.replaySummaryMd}\``);
    if (files?.experienceExportJson) lines.push(`- experience.export.json: \`${files.experienceExportJson}\``);
    if (files?.g0ReportsJson) lines.push(`- g0-reports.json: \`${files.g0ReportsJson}\``);
    lines.push('');
  }

  if (summary.blocked) {
    lines.push('## Blocked reason');
    lines.push('');
    const blocked = results.filter((r) => r.outcome === 'blocked');
    if (blocked.length === 0) {
      lines.push('- blocked=true but no item has outcome=blocked (inconsistent input)');
    } else {
      for (const r of blocked) {
        const regressions = (r.capabilityDrift ?? []).filter((d) => d.severity === 'regression');
        const regFields = regressions.map((d) => d.field);
        lines.push(
          `- \`${r.experienceItemId}\`: reportId=\`${r.reportId}\`, regressions=${joinFields(regFields)}`
        );
        if (regressions.length) {
          lines.push('');
          lines.push(indentLines(renderDriftDetails(regressions), '  '));
        }
      }
    }
    lines.push('');
  }

  lines.push('## Items');
  lines.push('');
  for (const r of results) {
    const driftCount = (r.capabilityDrift ?? []).length;
    lines.push(
      `- \`${r.experienceItemId}\`: ok=${r.ok ? 'true' : 'false'}, outcome=\`${r.outcome}\`, reportId=\`${r.reportId}\`, drift=${driftCount}`
    );
    if (r.failureStage) {
      lines.push(`  - failure: stage=\`${r.failureStage}\`${r.failureMessage ? `, message=\`${r.failureMessage}\`` : ''}`);
    }
    if (driftCount) {
      lines.push('');
      lines.push(indentLines(renderDriftDetails(r.capabilityDrift ?? []), '  '));
    }
  }
  lines.push('');

  lines.push('## Note');
  lines.push('');
  lines.push(summary.note);
  lines.push('');

  return lines.join('\n');
}

