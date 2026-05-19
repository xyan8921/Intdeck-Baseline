import type { EvidenceManifestV1 } from './evidenceManifest';

export type GatesSummaryV1 = {
  schemaVersion: number;
  overallPassed: boolean;
  startedAt?: string;
  finishedAt?: string;
  results: Array<{
    gate: string;
    passed: boolean;
    durationMs: number;
    errorSummary?: string;
  }>;
};

export type ReplayResultsSummarySlice = {
  ok: boolean;
  itemsReplayed: number;
  blocked: boolean;
  inputSource?: string;
  exportPackagePath?: string | null;
};

export function renderEvidenceSummaryMarkdownV1(input: {
  manifest: EvidenceManifestV1;
  gates?: GatesSummaryV1 | null;
  replaySummary?: ReplayResultsSummarySlice | null;
  generatedAt?: string;
}): string {
  const { manifest, gates, replaySummary } = input;
  const lines: string[] = [];
  const at = input.generatedAt ?? manifest.generatedAt;

  lines.push('# Intdeck Agent 证据包摘要（人读版）');
  lines.push('');
  lines.push(`- 生成时间：\`${at}\``);
  lines.push(`- 命令：\`${manifest.command}\``);
  lines.push(`- 输出目录：\`${manifest.outDir}\``);
  lines.push('');

  lines.push('## 环境与配置');
  lines.push('');
  lines.push(`- Git：commit=\`${manifest.repo.commitSha?.slice(0, 12) ?? 'null'}…\`, branch=\`${manifest.repo.branch ?? 'null'}\`, dirty=\`${manifest.repo.isDirty ?? 'null'}\``);
  lines.push(
    `- 运行时：Node \`${manifest.runtime.nodeVersion}\`, \`${manifest.runtime.platform}\` / \`${manifest.runtime.arch}\``
  );
  lines.push(`- 配置指纹：\`${manifest.config.configSha256?.slice(0, 12) ?? 'null'}…\``);
  lines.push('');

  if (gates) {
    lines.push('## 门禁（gates.summary.json）');
    lines.push('');
    lines.push(`- 总体：${gates.overallPassed ? '**通过**' : '**未通过**'}`);
    for (const g of gates.results) {
      lines.push(`- \`${g.gate}\`：${g.passed ? '通过' : '失败'} (${g.durationMs}ms)${g.errorSummary ? ` — ${g.errorSummary.slice(0, 120)}` : ''}`);
    }
    lines.push('');
  }

  if (replaySummary) {
    lines.push('## 回放（replay）');
    lines.push('');
    lines.push(`- 结果：${replaySummary.ok ? '**通过**' : '**未通过**'}`);
    lines.push(`- 回放条数：${replaySummary.itemsReplayed}`);
    lines.push(`- 是否阻断：${replaySummary.blocked ? '是' : '否'}`);
    if (replaySummary.inputSource) lines.push(`- 输入来源：\`${replaySummary.inputSource}\``);
    if (replaySummary.exportPackagePath !== undefined) {
      lines.push(`- 导出包路径：\`${replaySummary.exportPackagePath ?? 'null'}\``);
    }
    lines.push('');
  }

  lines.push('## 关键产物（含指纹）');
  lines.push('');
  const outputs = manifest.outputs.filter((o) => o.sha256Hex);
  if (outputs.length === 0) {
    lines.push('- （尚无已写入文件的指纹记录）');
  } else {
    for (const o of outputs) {
      lines.push(`- \`${o.path}\`：sha256=\`${o.sha256Hex?.slice(0, 12)}…\`, ${o.bytes ?? 0} bytes`);
    }
  }
  lines.push('');

  if (manifest.notes?.length) {
    lines.push('## 备注');
    lines.push('');
    for (const n of manifest.notes) lines.push(`- ${n}`);
    lines.push('');
  }

  lines.push('## 交付建议');
  lines.push('');
  lines.push('- 对外交付：本文件 + `evidence.manifest.json` + `g0-reports.json` + `experience.export.json`');
  lines.push('- 若含回放：另附 `replay.summary.md`');
  lines.push('- 发版前确认：`gates.summary.json` 中 `overallPassed=true`（若已运行 gates）');
  lines.push('');

  return lines.join('\n');
}
