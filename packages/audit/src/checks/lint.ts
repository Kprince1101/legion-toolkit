import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { localBin, run } from '../exec.js';
import type { Finding, LintResult, RuleCount } from '../types.js';

interface OxlintLabel {
  span?: { line?: number; column?: number };
}

interface OxlintDiagnostic {
  message?: string;
  code?: string;
  severity?: string;
  filename?: string;
  labels?: OxlintLabel[];
}

interface EslintMessage {
  ruleId?: string | null;
  severity?: number;
  line?: number;
  message?: string;
}

interface EslintFileResult {
  filePath?: string;
  messages?: EslintMessage[];
}

const OXLINT_CONFIGS = [
  '.oxlintrc.json',
  '.oxlintrc.jsonc',
  'oxlint.config.ts',
  'oxlint.config.mts',
];

const ESLINT_CONFIGS = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  'eslint.config.mts',
];

const hasAny = (root: string, names: string[]): boolean =>
  names.some((name) => existsSync(join(root, name)));

export const detectLinter = (root: string): LintResult['linter'] => {
  if (hasAny(root, OXLINT_CONFIGS) && localBin(root, 'oxlint')) return 'oxlint';
  if (hasAny(root, ESLINT_CONFIGS) && localBin(root, 'eslint')) return 'eslint';
  if (localBin(root, 'oxlint')) return 'oxlint';
  if (localBin(root, 'eslint')) return 'eslint';
  return 'none';
};

const oxlintRuleId = (code: string | undefined): string => {
  if (!code) return 'unknown';
  const match = /^([^(]+)\(([^)]+)\)$/.exec(code);
  if (!match) return code;
  const [, plugin, rule] = match;
  if (plugin === 'eslint') return rule ?? code;
  return `${plugin}/${rule}`;
};

const severityOf = (isWarning: boolean): Finding['severity'] => {
  if (isWarning) return 'warning';
  return 'error';
};

export const parseOxlintJson = (text: string): Finding[] => {
  const start = text.indexOf('{');
  if (start === -1) return [];
  const parsed = JSON.parse(text.slice(start)) as {
    diagnostics?: OxlintDiagnostic[];
  };
  return (parsed.diagnostics ?? []).map((diagnostic) => ({
    rule: oxlintRuleId(diagnostic.code),
    file: diagnostic.filename ?? '',
    line: diagnostic.labels?.[0]?.span?.line ?? 0,
    message: diagnostic.message ?? '',
    severity: severityOf(diagnostic.severity === 'warning'),
  }));
};

export const parseEslintJson = (text: string, root: string): Finding[] => {
  const start = text.indexOf('[');
  if (start === -1) return [];
  const parsed = JSON.parse(text.slice(start)) as EslintFileResult[];
  const findings: Finding[] = [];
  for (const fileResult of parsed) {
    const file = (fileResult.filePath ?? '')
      .replace(root, '')
      .replace(/^[\\/]/, '')
      .split('\\')
      .join('/');
    for (const message of fileResult.messages ?? []) {
      findings.push({
        rule: message.ruleId ?? 'parse-error',
        file,
        line: message.line ?? 0,
        message: message.message ?? '',
        severity: severityOf(message.severity === 1),
      });
    }
  }
  return findings;
};

export const countByRule = (findings: Finding[]): RuleCount[] => {
  const counts = new Map<string, RuleCount>();
  for (const finding of findings) {
    const entry = counts.get(finding.rule) ?? {
      rule: finding.rule,
      errors: 0,
      warnings: 0,
    };
    if (finding.severity === 'error') entry.errors += 1;
    if (finding.severity === 'warning') entry.warnings += 1;
    counts.set(finding.rule, entry);
  }
  return [...counts.values()].sort(
    (a, b) => b.errors - a.errors || b.warnings - a.warnings,
  );
};

export const summarizeFindings = (
  linter: LintResult['linter'],
  findings: Finding[],
  exitCode: number,
): LintResult => {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  let status: LintResult['status'] = 'pass';
  if (exitCode !== 0 || errors > 0) status = 'fail';
  return {
    linter,
    status,
    errors,
    warnings,
    rules: countByRule(findings),
    legion: findings.filter((f) => f.rule.startsWith('legion/')),
    componentCap: findings.filter(
      (f) => f.rule === 'max-lines' && f.file.endsWith('.tsx'),
    ),
  };
};

const NO_LINTER: LintResult = {
  linter: 'none',
  status: 'skipped',
  errors: 0,
  warnings: 0,
  rules: [],
  legion: [],
  componentCap: [],
};

export const runLint = (root: string): LintResult & { command?: string } => {
  const linter = detectLinter(root);
  if (linter === 'none') return NO_LINTER;
  const bin = localBin(root, linter);
  if (!bin) return NO_LINTER;
  if (linter === 'oxlint') {
    const result = run(bin, ['--format', 'json', '.'], root);
    let findings: Finding[] = [];
    try {
      findings = parseOxlintJson(result.stdout);
    } catch {
      return { ...NO_LINTER, linter, status: 'fail', command: result.command };
    }
    return {
      ...summarizeFindings(linter, findings, result.code),
      command: result.command,
    };
  }
  const result = run(bin, ['--format', 'json', '.'], root);
  let findings: Finding[] = [];
  try {
    findings = parseEslintJson(result.stdout, root);
  } catch {
    return { ...NO_LINTER, linter, status: 'fail', command: result.command };
  }
  return {
    ...summarizeFindings(linter, findings, result.code),
    command: result.command,
  };
};
