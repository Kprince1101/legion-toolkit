import type { AuditResult, Finding, GateResult, Regression } from '../types.js';

const ICONS: Record<GateResult['status'], string> = {
  pass: 'pass',
  fail: 'FAIL',
  skipped: 'skipped',
};

const MAX_LISTED = 25;

const table = (header: string[], rows: string[][]): string => {
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  const divider = `|${header.map(() => '---').join('|')}|`;
  return [line(header), divider, ...rows.map(line)].join('\n');
};

const percent = (ratio: number): string => `${Math.round(ratio * 100)}%`;

const listFindings = (findings: Finding[]): string => {
  const shown = findings.slice(0, MAX_LISTED);
  const lines = shown.map(
    (finding) =>
      `- \`${finding.file}:${finding.line}\` ${finding.rule}: ${finding.message}`,
  );
  if (findings.length > MAX_LISTED) {
    lines.push(`- ... and ${findings.length - MAX_LISTED} more`);
  }
  return lines.join('\n');
};

const gatesSection = (result: AuditResult): string => {
  const rows = result.gates.map((gate) => [
    gate.name,
    ICONS[gate.status],
    gate.summary,
  ]);
  return table(['Gate', 'Result', 'Detail'], rows);
};

const lockfileLine = (result: AuditResult): string => {
  if (result.lockfile.found.length === 0) {
    return `${ICONS[result.lockfile.status]}: no lockfile found`;
  }
  return `${ICONS[result.lockfile.status]}: ${result.lockfile.found.join(', ')}`;
};

const rulesSection = (result: AuditResult): string => {
  const legion = result.lint.rules.filter((rule) =>
    rule.rule.startsWith('legion/'),
  );
  if (legion.length === 0)
    return 'No `legion/*` findings (or the plugin is not installed in this repo).';
  const rows = legion.map((rule) => [
    rule.rule,
    String(rule.errors),
    String(rule.warnings),
  ]);
  return table(['Rule', 'Errors', 'Warnings'], rows);
};

const bypassSection = (result: AuditResult): string => {
  const { directives } = result;
  const disables = directives.all.filter((hit) => hit.kind === 'disable');
  const parts: string[] = [];
  parts.push(
    `${disables.length} disable directive(s), ${directives.nosonar.length} NOSONAR marker(s), ${directives.fileWide.length} file-wide disable(s).`,
  );
  const byRule = Object.entries(directives.byRule).sort((a, b) => b[1] - a[1]);
  if (byRule.length > 0) {
    parts.push(
      table(
        ['Bypassed rule', 'Count'],
        byRule.map(([rule, count]) => [rule, String(count)]),
      ),
    );
  }
  if (directives.fileWide.length > 0) {
    parts.push('File-wide disables (hard fail):');
    parts.push(
      directives.fileWide
        .map((hit) => `- \`${hit.file}:${hit.line}\``)
        .join('\n'),
    );
  }
  const explained = disables.filter((hit) => hit.description.length > 0).length;
  if (disables.length > 0) {
    parts.push(`${explained}/${disables.length} directives carry a reason.`);
  }
  return parts.join('\n\n');
};

const prSection = (result: AuditResult): string => {
  const { prHygiene } = result;
  if (prHygiene.status === 'skipped') return 'Not a git repository.';
  const lines = [
    `${prHygiene.withPr} of the last ${prHygiene.inspected} commits carry a PR number (${percent(prHygiene.ratio)}).`,
  ];
  if (prHygiene.lastPrCommit)
    lines.push(`Most recent PR-tagged commit: \`${prHygiene.lastPrCommit}\`.`);
  return lines.join('\n');
};

const coverageSection = (result: AuditResult): string => {
  const { testCoverage } = result;
  const total = testCoverage.components + testCoverage.hooks;
  const lines = [
    `${testCoverage.components} component(s) and ${testCoverage.hooks} hook(s) found; ${testCoverage.missing.length} of ${total} have no test file.`,
  ];
  if (testCoverage.missing.length > 0) {
    const shown = testCoverage.missing.slice(0, MAX_LISTED);
    lines.push(
      shown.map((entry) => `- \`${entry.file}\` (${entry.kind})`).join('\n'),
    );
    if (testCoverage.missing.length > MAX_LISTED) {
      lines.push(`- ... and ${testCoverage.missing.length - MAX_LISTED} more`);
    }
  }
  return lines.join('\n');
};

const adviceSection = (result: AuditResult): string => {
  if (result.advice.length === 0) {
    return 'No nudges. This repo is set up the way Legion ships.';
  }
  const blocks = result.advice.map((entry) => {
    const lines = [`### ${entry.title}`, entry.why];
    lines.push(['```sh', ...entry.fix, '```'].join('\n'));
    if (entry.detail.length > 0) {
      lines.push(entry.detail.map((line) => `- ${line}`).join('\n'));
    }
    return lines.join('\n\n');
  });
  return [
    'Advisory only. None of these affect the score or the exit code.',
    ...blocks,
  ].join('\n\n');
};

const toolchainSection = (result: AuditResult): string => {
  const { toolchain } = result;
  return table(
    ['Fact', 'Value'],
    [
      [
        'package manager',
        `${toolchain.packageManager} (${toolchain.yarnFlavor})`,
      ],
      ['packageManager field', toolchain.packageManagerField ?? 'not set'],
      ['framework', toolchain.framework],
      ['workspaces', String(toolchain.workspaces)],
      [
        'linter config',
        `oxlint ${toolchain.hasOxlintConfig}, eslint ${toolchain.hasEslintConfig}`,
      ],
      ['legion plugin wired', String(toolchain.pluginReferenced)],
      ['prettier config', String(toolchain.hasPrettierConfig)],
      ['tsconfig', String(toolchain.hasTsconfig)],
    ],
  );
};

const regressionSection = (regressions: Regression[]): string => {
  if (regressions.length === 0) return 'No regressions against the baseline.';
  return table(
    ['Area', 'Baseline', 'Now'],
    regressions.map((entry) => [entry.area, entry.before, entry.after]),
  );
};

export const renderMarkdown = (
  result: AuditResult,
  regressions: Regression[] | null,
): string => {
  const sections = [
    `# Legion audit`,
    `Generated ${result.generatedAt} for \`${result.root}\` (${result.packageManager}). Score: **${result.score}/100**.`,
    `## Gates`,
    gatesSection(result),
    `## Legion rules`,
    rulesSection(result),
  ];
  if (result.lint.componentCap.length > 0) {
    sections.push(
      `## Components over the line cap`,
      listFindings(result.lint.componentCap),
    );
  }
  if (result.lint.legion.length > 0) {
    sections.push(`## Legion findings`, listFindings(result.lint.legion));
  }
  sections.push(`## Lint bypasses`, bypassSection(result));
  sections.push(`## PR hygiene`, prSection(result));
  sections.push(`## Tests by file`, coverageSection(result));
  sections.push(`## Lockfile`, lockfileLine(result));
  sections.push(`## Toolchain`, toolchainSection(result));
  sections.push(`## Nudges`, adviceSection(result));
  if (regressions !== null)
    sections.push(`## Baseline`, regressionSection(regressions));
  sections.push(
    `## Score formula`,
    'Start at 100. Minus 2 per `legion/*` error (cap 40), 0.5 per lint warning (cap 10), 15 for a failed typecheck, 15 for a failed lint, 20 for failed tests, 5 for unformatted files, up to 15 scaled by the *share* of components and hooks with no test, and 5 per file-wide disable (cap 15).\n\nTwo things deliberately do not score. PR hygiene is history on `main`: it cannot be fixed retroactively and it corrects itself as PR-tagged commits land, so it is a nudge instead. And the test penalty is a share rather than a count, so decomposing one oversized component into ten presentational children cannot make the score worse than the component it replaced. The number is for comparing runs of the same repo, not for comparing repos.',
  );
  return `${sections.join('\n\n')}\n`;
};
