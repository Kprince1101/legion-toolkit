import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPlan } from './apply.js';
import { linterFor, presetFor } from './detect.js';
import { buildPlan, missingScripts } from './plan.js';
import { renderPlan } from './report.js';
import { installCommand, presetPath, tsconfigBase } from './templates.js';
import type { InitDetection } from './types.js';

const detection = (overrides: Partial<InitDetection> = {}): InitDetection => ({
  root: '/repo',
  packageManager: 'yarn',
  linter: 'oxlint',
  preset: 'recommended',
  framework: 'next',
  hasOxlintConfig: false,
  hasEslintConfig: false,
  hasPrettierConfig: false,
  hasTsconfig: false,
  pluginReferenced: false,
  agents: [],
  scripts: {},
  ...overrides,
});

const repo = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), 'legion-init-'));
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, contents);
  }
  return root;
};

describe('presetFor', () => {
  it('picks reactNative for a native framework and recommended otherwise', () => {
    expect(presetFor('expo')).toBe('reactNative');
    expect(presetFor('react-native')).toBe('reactNative');
    expect(presetFor('next')).toBe('recommended');
    expect(presetFor('node')).toBe('recommended');
  });
});

describe('linterFor', () => {
  it('follows an existing config and defaults a new repo to oxlint', () => {
    expect(linterFor(true, false)).toBe('oxlint');
    expect(linterFor(false, true)).toBe('eslint');
    expect(linterFor(false, false)).toBe('oxlint');
  });
});

describe('tsconfigBase', () => {
  it('maps the framework onto a shipped base', () => {
    expect(tsconfigBase('expo')).toBe('react-native');
    expect(tsconfigBase('next')).toBe('next');
    expect(tsconfigBase('node')).toBe('node');
    expect(tsconfigBase('vite')).toBe('base');
  });
});

describe('installCommand', () => {
  it('speaks the package manager the repo already uses', () => {
    expect(installCommand('npm', ['a', 'b'])).toEqual(['npm install -D a b']);
    expect(installCommand('pnpm', ['a'])).toEqual(['pnpm add -D a']);
    expect(installCommand('bun', ['a'])).toEqual(['bun add -d a']);
    expect(installCommand('yarn', ['a'])).toEqual(['yarn add -D a']);
    expect(installCommand('unknown', ['a'])).toEqual(['yarn add -D a']);
  });
});

describe('missingScripts', () => {
  it('never proposes replacing a script that already exists', () => {
    expect(missingScripts(detection({ scripts: { lint: 'custom' } }))).toEqual([
      'audit',
    ]);
    expect(
      missingScripts(detection({ scripts: { lint: 'x', audit: 'y' } })),
    ).toEqual([]);
    expect(missingScripts(detection())).toEqual(['lint', 'audit']);
  });
});

describe('buildPlan', () => {
  it('creates a lint config that extends the shipped preset', () => {
    const root = repo({ 'package.json': '{}' });
    const plan = buildPlan(detection({ root }), 'reactNative');
    const lint = plan.actions.find((a) => a.path === '.oxlintrc.json');
    expect(lint?.kind).toBe('create');
    expect(lint?.contents).toContain(presetPath('reactNative'));
    expect(lint?.contents).toContain('react-native.json');
  });

  it('skips a lint config that already references the plugin', () => {
    const root = repo({
      'package.json': '{}',
      '.oxlintrc.json': '{"jsPlugins":["legion-toolkit/eslint-plugin"]}',
    });
    const plan = buildPlan(detection({ root }), 'recommended');
    expect(plan.actions.find((a) => a.path === '.oxlintrc.json')?.kind).toBe(
      'skip',
    );
  });

  it('merges rather than overwrites a lint config that does not mention legion', () => {
    const root = repo({
      'package.json': '{}',
      '.oxlintrc.json': '{"rules":{"no-debugger":"error"}}',
    });
    const plan = buildPlan(detection({ root }), 'recommended');
    expect(plan.actions.find((a) => a.path === '.oxlintrc.json')?.kind).toBe(
      'merge',
    );
  });

  it('leaves an existing tsconfig and prettier config alone', () => {
    const plan = buildPlan(
      detection({ hasTsconfig: true, hasPrettierConfig: true }),
      'recommended',
    );
    const skipped = plan.actions.filter((a) => a.kind === 'skip');
    expect(skipped.map((a) => a.path)).toEqual(
      expect.arrayContaining(['tsconfig.json', 'package.json']),
    );
  });
});

describe('applyPlan', () => {
  it('writes the new files and adds only the missing scripts', () => {
    const root = repo({
      'package.json': JSON.stringify({
        name: 'app',
        scripts: { lint: 'my own lint' },
      }),
    });
    const plan = buildPlan(
      detection({ root, scripts: { lint: 'my own lint' } }),
      'recommended',
    );
    const written = applyPlan(plan);
    expect(written).toEqual(
      expect.arrayContaining([
        '.oxlintrc.json',
        'tsconfig.json',
        'package.json',
      ]),
    );
    const manifest = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    );
    expect(manifest.scripts.lint).toBe('my own lint');
    expect(manifest.scripts.audit).toContain('legion-audit');
    expect(manifest.prettier).toBe('legion-toolkit/prettier');
  });

  it('does not touch a repo that is already wired', () => {
    const root = repo({
      'package.json': JSON.stringify({
        name: 'app',
        prettier: 'legion-toolkit/prettier',
        scripts: { lint: 'oxlint .', audit: 'legion-audit' },
      }),
      'tsconfig.json': '{}',
      '.oxlintrc.json': '{"jsPlugins":["legion-toolkit/eslint-plugin"]}',
    });
    const plan = buildPlan(
      detection({
        root,
        hasTsconfig: true,
        hasPrettierConfig: true,
        scripts: { lint: 'oxlint .', audit: 'legion-audit' },
      }),
      'recommended',
    );
    expect(applyPlan(plan)).toEqual([]);
  });
});

describe('renderPlan', () => {
  it('states what was detected and promises not to overwrite', () => {
    const root = repo({
      'package.json': '{}',
      '.oxlintrc.json': '{"rules":{}}',
    });
    const output = renderPlan(
      buildPlan(detection({ root, agents: ['Claude Code'] }), 'recommended'),
    );
    expect(output).toContain('DETECTED');
    expect(output).toContain('Claude Code');
    expect(output).toContain('Nothing is overwritten');
    expect(output).toContain('yarn add -D');
  });
});

describe('a package.json that cannot be parsed', () => {
  it('refuses to write rather than replacing it with a stub', () => {
    const root = repo({ 'package.json': '{ this is not json' });
    const plan = buildPlan(detection({ root }), 'recommended');
    expect(() => applyPlan(plan)).toThrow(/nothing was written/);
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(
      '{ this is not json',
    );
  });

  it('writes no other file either, so a failure leaves nothing half done', () => {
    const root = repo({ 'package.json': '{ this is not json' });
    const plan = buildPlan(detection({ root }), 'recommended');
    expect(() => applyPlan(plan)).toThrow();
    expect(existsSync(join(root, 'tsconfig.json'))).toBe(false);
    expect(existsSync(join(root, '.oxlintrc.json'))).toBe(false);
  });

  it('refuses on an unparseable lint config too', () => {
    const root = repo({
      'package.json': '{"name":"app"}',
      '.oxlintrc.json': '{ nope',
    });
    const plan = buildPlan(detection({ root }), 'recommended');
    expect(() => applyPlan(plan)).toThrow(/\.oxlintrc\.json/);
    expect(existsSync(join(root, 'tsconfig.json'))).toBe(false);
  });

  it('treats a missing package.json as empty rather than an error', () => {
    const root = repo({ 'tsconfig.json': '{}' });
    const plan = buildPlan(
      detection({ root, hasTsconfig: true }),
      'recommended',
    );
    expect(() => applyPlan(plan)).not.toThrow();
  });
});

describe('merging into an existing oxlint config', () => {
  it('adds the extends and keeps every other key', () => {
    const root = repo({
      'package.json': '{"name":"app"}',
      '.oxlintrc.json': JSON.stringify({
        rules: { 'no-debugger': 'error' },
        ignorePatterns: ['vendor/**'],
      }),
    });
    const plan = buildPlan(detection({ root }), 'recommended');
    const action = plan.actions.find((a) => a.path === '.oxlintrc.json');
    expect(action?.kind).toBe('merge');
    applyPlan(plan);
    const written = JSON.parse(
      readFileSync(join(root, '.oxlintrc.json'), 'utf8'),
    );
    expect(written.extends).toEqual([presetPath('recommended')]);
    expect(written.rules).toEqual({ 'no-debugger': 'error' });
    expect(written.ignorePatterns).toEqual(['vendor/**']);
  });

  it('is idempotent, so a second run adds nothing', () => {
    const root = repo({
      'package.json': '{"name":"app"}',
      '.oxlintrc.json': JSON.stringify({ rules: {} }),
    });
    applyPlan(buildPlan(detection({ root }), 'recommended'));
    const first = readFileSync(join(root, '.oxlintrc.json'), 'utf8');
    applyPlan(buildPlan(detection({ root }), 'recommended'));
    expect(readFileSync(join(root, '.oxlintrc.json'), 'utf8')).toBe(first);
  });
});

describe('an existing JavaScript eslint config', () => {
  it('is reported as manual rather than claimed as an edit', () => {
    const root = repo({
      'package.json': '{"name":"app"}',
      'eslint.config.mjs': 'export default [];',
    });
    const plan = buildPlan(
      detection({ root, linter: 'eslint', hasEslintConfig: true }),
      'recommended',
    );
    const action = plan.actions.find((a) => a.path === 'eslint.config.mjs');
    expect(action?.kind).toBe('manual');
    applyPlan(plan);
    expect(readFileSync(join(root, 'eslint.config.mjs'), 'utf8')).toBe(
      'export default [];',
    );
    const output = renderPlan(plan);
    expect(output).toContain('manual is yours to apply');
    expect(output).not.toContain('Files marked merge are edited in place');
  });
});
