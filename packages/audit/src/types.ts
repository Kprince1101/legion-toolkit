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

export type Forge = 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'unknown';

export interface PrHygiene {
  status: GateStatus;
  inspected: number;
  withPr: number;
  ratio: number;
  lastPrCommit: string | null;
  forge: Forge;
}

export interface DependencyFinding {
  name: string;
  version: string;
  reason: string;
  instead: string;
}

export interface DependencyResult {
  status: 'checked' | 'skipped';
  forbidden: DependencyFinding[];
  inspected: number;
}

export interface SuppressionFile {
  schema: 1;
  counts: Record<string, number>;
}

export interface SuppressionResult {
  findings: Finding[];
  suppressed: number;
  stale: string[];
  total: number;
}

export interface RuleCoverage {
  status: 'checked' | 'skipped';
  available: string[];
  configured: string[];
  unconfigured: string[];
  source: 'oxlint' | 'eslint' | 'none';
}

export interface MissingTest {
  file: string;
  kind: 'component' | 'hook';
}

export type CoverageSource = 'coverage-report' | 'references' | 'filenames';

export interface CoverageReport {
  available: boolean;
  files: Record<string, boolean>;
  totalPct: number | null;
}

export interface TestCoverage {
  components: number;
  hooks: number;
  missing: MissingTest[];
  source: CoverageSource;
  totalPct: number | null;
}

export interface LockfileResult {
  status: GateStatus;
  found: string[];
  packageManager: PackageManager;
}

export type PackageManager = 'yarn' | 'npm' | 'pnpm' | 'bun' | 'unknown';

export type YarnFlavor = 'berry' | 'classic' | 'unknown' | 'none';

export type Framework =
  'expo' | 'react-native' | 'next' | 'vite' | 'react' | 'node';

export interface WorkspaceContext {
  root: string;
  workspaceRoot: string;
  isPackage: boolean;
}

export interface Toolchain {
  packageManager: PackageManager;
  yarnFlavor: YarnFlavor;
  packageManagerField: string | null;
  framework: Framework;
  workspaces: boolean;
  hasOxlintConfig: boolean;
  hasEslintConfig: boolean;
  hasOxlintBin: boolean;
  hasEslintBin: boolean;
  hasPrettierConfig: boolean;
  hasTsconfig: boolean;
  toolkitInstalled: boolean;
  pluginReferenced: boolean;
  workspaceRoot: string;
  isWorkspacePackage: boolean;
  reactCompiler: boolean;
  scripts: Record<string, string>;
}

export interface VersionDrift {
  name: string;
  expected: string;
  found: string;
}

export interface ExpoDoctorResult extends GateResult {
  patchDrift: VersionDrift[];
  installed: boolean;
}

export type AdviceArea =
  'toolchain' | 'rules' | 'tests' | 'bypasses' | 'process';

export interface Advice {
  id: string;
  area: AdviceArea;
  title: string;
  why: string;
  fix: string[];
  detail: string[];
}

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
  toolchain: Toolchain;
  expo: ExpoDoctorResult;
  ruleCoverage: RuleCoverage;
  suppressions: SuppressionResult;
  dependencies: DependencyResult;
  workspace: WorkspaceContext;
  advice: Advice[];
}

export interface AuditOptions {
  root: string;
  depsAudit: boolean;
  runTests: boolean;
  runTypecheck: boolean;
  runFormat: boolean;
  runExpoDoctor: boolean;
  quiet: boolean;
  commitsToInspect: number;
  ignore: string[];
}

export interface Regression {
  area: string;
  before: string;
  after: string;
}
