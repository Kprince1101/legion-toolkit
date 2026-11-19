export interface StepResult {
  step: string;
  ok: boolean;
  subtype: string | null;
  sessionId: string | null;
  costUsd: number | null;
  durationMs: number | null;
  turns: number | null;
}

interface ClaudeResult {
  subtype?: string;
  is_error?: boolean;
  session_id?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
}

const numberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const stringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  return null;
};

export const parseStepResult = (step: string, text: string): StepResult => {
  let parsed: ClaudeResult = {};
  try {
    parsed = JSON.parse(text) as ClaudeResult;
  } catch {
    return {
      step,
      ok: false,
      subtype: 'unparseable',
      sessionId: null,
      costUsd: null,
      durationMs: null,
      turns: null,
    };
  }
  return {
    step,
    ok: parsed.is_error !== true,
    subtype: stringOrNull(parsed.subtype),
    sessionId: stringOrNull(parsed.session_id),
    costUsd: numberOrNull(parsed.total_cost_usd),
    durationMs: numberOrNull(parsed.duration_ms),
    turns: numberOrNull(parsed.num_turns),
  };
};

export const totalCost = (steps: StepResult[]): number | null => {
  const costs = steps.flatMap((step) => {
    if (step.costUsd === null) return [];
    return [step.costUsd];
  });
  if (costs.length === 0) return null;
  return costs.reduce((sum, cost) => sum + cost, 0);
};

export interface AcceptanceSummary {
  ran: boolean;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  total: number;
  failures: string[];
  errors: string[];
}

interface PlaywrightSpec {
  title?: string;
  ok?: boolean;
}

interface PlaywrightSuite {
  title?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  stats?: {
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
  };
  suites?: PlaywrightSuite[];
  errors?: Array<{ message?: string }>;
}

export const NOT_RUN: AcceptanceSummary = {
  ran: false,
  passed: 0,
  failed: 0,
  flaky: 0,
  skipped: 0,
  total: 0,
  failures: [],
  errors: [],
};

const titled = (parents: string[], title: string | undefined): string[] => {
  if (title === undefined || title.length === 0) return parents;
  return [...parents, title];
};

const failingSpecs = (suite: PlaywrightSuite, parents: string[]): string[] => {
  const path = titled(parents, suite.title);
  const own = (suite.specs ?? [])
    .filter((spec) => spec.ok === false)
    .map((spec) => titled(path, spec.title).join(' › '));
  const nested = (suite.suites ?? []).flatMap((child) =>
    failingSpecs(child, path),
  );
  return [...own, ...nested];
};

export const parseAcceptance = (text: string): AcceptanceSummary => {
  let report: PlaywrightReport;
  try {
    report = JSON.parse(text) as PlaywrightReport;
  } catch {
    return {
      ...NOT_RUN,
      errors: ['the Playwright JSON report was unreadable'],
    };
  }
  const passed = report.stats?.expected ?? 0;
  const failed = report.stats?.unexpected ?? 0;
  const flaky = report.stats?.flaky ?? 0;
  const skipped = report.stats?.skipped ?? 0;
  return {
    ran: true,
    passed,
    failed,
    flaky,
    skipped,
    total: passed + failed + flaky + skipped,
    failures: (report.suites ?? []).flatMap((suite) => failingSpecs(suite, [])),
    errors: (report.errors ?? []).map(
      (error) => (error.message ?? '').split('\n')[0] ?? '',
    ),
  };
};

export interface RuleCount {
  rule: string;
  errors: number;
  warnings: number;
}

export interface AuditSummary {
  score: number;
  lintStatus: string;
  lintErrors: number;
  lintWarnings: number;
  legionFindings: number;
  componentCap: number;
  topRules: RuleCount[];
  directives: number;
  fileWideDirectives: number;
  directivesByRule: Record<string, number>;
  untested: number;
  lintErrorsAsWritten: number | null;
}

interface AuditJson {
  score?: number;
  lint?: {
    status?: string;
    errors?: number;
    warnings?: number;
    rules?: RuleCount[];
    legion?: unknown[];
    componentCap?: unknown[];
  };
  directives?: {
    all?: Array<{ kind?: string }>;
    fileWide?: unknown[];
    byRule?: Record<string, number>;
  };
  testCoverage?: { missing?: unknown[] };
}

const TOP_RULES = 5;

export const summarizeAudit = (text: string): AuditSummary => {
  const audit = JSON.parse(text) as AuditJson;
  const rules = [...(audit.lint?.rules ?? [])]
    .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings)
    .slice(0, TOP_RULES);
  return {
    score: audit.score ?? 0,
    lintStatus: audit.lint?.status ?? 'unknown',
    lintErrors: audit.lint?.errors ?? 0,
    lintWarnings: audit.lint?.warnings ?? 0,
    legionFindings: audit.lint?.legion?.length ?? 0,
    componentCap: audit.lint?.componentCap?.length ?? 0,
    topRules: rules,
    directives: (audit.directives?.all ?? []).filter(
      (hit) => hit.kind === 'disable',
    ).length,
    fileWideDirectives: audit.directives?.fileWide?.length ?? 0,
    directivesByRule: audit.directives?.byRule ?? {},
    untested: audit.testCoverage?.missing?.length ?? 0,
    lintErrorsAsWritten: null,
  };
};
