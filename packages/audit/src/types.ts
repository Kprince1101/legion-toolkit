export type GateStatus = 'pass' | 'fail' | 'skipped';

export interface GateResult {
  name: string;
  status: GateStatus;
  summary: string;
  command?: string;
  exitCode?: number;
}

export interface RuleCount {
  rule: string;
  errors: number;
  warnings: number;
}

export interface Finding {
  rule: string;
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface LintResult {
  linter: 'oxlint' | 'eslint' | 'none';
  status: GateStatus;
  errors: number;
  warnings: number;
  rules: RuleCount[];
  legion: Finding[];
  componentCap: Finding[];
}

export interface DirectiveHit {
  file: string;
  line: number;
  tool: 'eslint' | 'oxlint';
  kind: 'disable' | 'enable';
  scope: 'file' | 'next-line' | 'line';
  rules: string[];
  description: string;
}

export interface NosonarHit {
  file: string;
  line: number;
}

export interface DirectivesResult {
  fileWide: DirectiveHit[];
  all: DirectiveHit[];
  nosonar: NosonarHit[];
  byRule: Record<string, number>;
}

export interface PrHygiene {
  status: GateStatus;
  inspected: number;
  withPr: number;
  ratio: number;
  lastPrCommit: string | null;
}

export interface MissingTest {
  file: string;
  kind: 'component' | 'hook';
}

export interface TestCoverage {
  components: number;
  hooks: number;
  missing: MissingTest[];
}

export interface LockfileResult {
  status: GateStatus;
  found: string[];
  packageManager: PackageManager;
}

export type PackageManager = 'yarn' | 'npm' | 'pnpm' | 'bun' | 'unknown';

export interface AuditResult {
  schema: 1;
  generatedAt: string;
  root: string;
  packageManager: PackageManager;
  score: number;
  gates: GateResult[];
  lint: LintResult;
  directives: DirectivesResult;
  prHygiene: PrHygiene;
  testCoverage: TestCoverage;
  lockfile: LockfileResult;
}

export interface AuditOptions {
  root: string;
  depsAudit: boolean;
  runTests: boolean;
  runTypecheck: boolean;
  runFormat: boolean;
  quiet: boolean;
  commitsToInspect: number;
  ignore: string[];
}

export interface Regression {
  area: string;
  before: string;
  after: string;
}
