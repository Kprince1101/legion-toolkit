export type Linter = 'oxlint' | 'eslint';

export type Preset = 'recommended' | 'strict' | 'reactNative';

export interface InitDetection {
  root: string;
  packageManager: string;
  linter: Linter;
  preset: Preset;
  framework: string;
  hasOxlintConfig: boolean;
  hasEslintConfig: boolean;
  hasPrettierConfig: boolean;
  hasTsconfig: boolean;
  pluginReferenced: boolean;
  agents: string[];
  scripts: Record<string, string>;
}

export type ActionKind = 'create' | 'merge' | 'skip';

export interface PlannedAction {
  kind: ActionKind;
  path: string;
  reason: string;
  contents?: string;
}

export interface InitPlan {
  detection: InitDetection;
  actions: PlannedAction[];
  install: string[];
}

export interface InitOptions {
  root: string;
  yes: boolean;
  dryRun: boolean;
  preset: Preset | null;
  linter: Linter | null;
}
