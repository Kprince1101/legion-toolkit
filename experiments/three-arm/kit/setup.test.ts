import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseKitArgs } from './args.ts';
import {
  ancestorsOf,
  inheritedInstructions,
  projectSlug,
  userConfigWarnings,
} from './isolation.ts';
import {
  checkoutPlan,
  mergeManifest,
  npmPlan,
  packArgs,
  STEER_INIT,
} from './setup.ts';
import { claudeArgs, isResultFile, listSteps, stepsFrom } from './steps.ts';

describe('parseKitArgs', () => {
  it('reads a setup command', () => {
    const args = parseKitArgs([
      'setup',
      '--arm',
      'steered',
      '--run-dir',
      '/tmp/arms/steered-1',
      '--toolkit',
      'file:/tmp/legion-toolkit.tgz',
    ]);
    expect(args).toMatchObject({
      command: 'setup',
      arm: 'steered',
      runDir: '/tmp/arms/steered-1',
      toolkit: 'file:/tmp/legion-toolkit.tgz',
      install: true,
    });
  });

  it('defaults to help and rejects what it does not know', () => {
    expect(parseKitArgs([]).command).toBe('help');
    expect(() => parseKitArgs(['setup', '--arm', 'linted'])).toThrow(
      '--arm must be one of raw, prose, steered',
    );
    expect(() => parseKitArgs(['run', '--model'])).toThrow(
      '--model needs a value',
    );
    expect(() => parseKitArgs(['collect', '--fast'])).toThrow(
      'unknown argument: --fast',
    );
  });
});

describe('isolation', () => {
  it('walks every ancestor up to the root', () => {
    expect(ancestorsOf('/a/b/c')).toEqual(['/a/b', '/a', '/']);
  });

  it('finds an instruction file a run would inherit', () => {
    const present = new Set([
      '/repos/CLAUDE.md',
      '/home/me/.claude/settings.json',
    ]);
    expect(
      inheritedInstructions('/repos/runs/raw-1', (path) => present.has(path), [
        '/home/me/.claude/settings.json',
      ]),
    ).toEqual(['/repos/CLAUDE.md']);
  });

  it('warns about user-level memory and hooks', () => {
    const files: Record<string, string> = {
      [join('/cfg', 'CLAUDE.md')]: 'Always use tabs',
      [join('/cfg', 'settings.json')]: '{"hooks":{}}',
    };
    expect(
      userConfigWarnings('/cfg', (path) => files[path] ?? null),
    ).toHaveLength(2);
    expect(userConfigWarnings('/cfg', () => null)).toEqual([]);
  });

  it('builds the Claude Code project folder name', () => {
    expect(projectSlug('/private/tmp/arms/raw-1/workspace')).toBe(
      '-private-tmp-arms-raw-1-workspace',
    );
  });
});

describe('setup', () => {
  const overlay = {
    scripts: { lint: 'legion-audit directives && oxlint .' },
    devDependencies: { oxlint: '1.89.0' },
  };

  it('installs this checkout by default, every package from its tarball', () => {
    const plan = checkoutPlan({
      'legion-toolkit': '/runs/steered-1/toolkit/legion-toolkit.tgz',
      'legion-steer': '/runs/steered-1/toolkit/legion-steer.tgz',
    });
    const merged = mergeManifest(
      {
        name: 'habit-tracker',
        scripts: { build: 'next build' },
        devDependencies: { typescript: '6.0.3' },
      },
      overlay,
      plan,
    );
    expect(merged).toEqual({
      name: 'habit-tracker',
      scripts: {
        build: 'next build',
        lint: 'legion-audit directives && oxlint .',
      },
      devDependencies: {
        typescript: '6.0.3',
        oxlint: '1.89.0',
        'legion-toolkit': 'file:/runs/steered-1/toolkit/legion-toolkit.tgz',
      },
      overrides: {
        'legion-toolkit': 'file:/runs/steered-1/toolkit/legion-toolkit.tgz',
        'legion-steer': 'file:/runs/steered-1/toolkit/legion-steer.tgz',
      },
    });
    expect(plan.source).toBe('checkout');
  });

  it('installs a published version when --toolkit names one', () => {
    const merged = mergeManifest({}, overlay, npmPlan('0.5.0'));
    expect(merged.devDependencies?.['legion-toolkit']).toBe('0.5.0');
    expect(merged.overrides).toBeUndefined();
  });

  it('refuses a pack without the toolkit tarball', () => {
    expect(() => checkoutPlan({ 'legion-steer': '/x.tgz' })).toThrow(
      'no legion-toolkit tarball',
    );
  });

  it('packs every workspace package', () => {
    expect(packArgs('/runs/s/toolkit')).toEqual([
      '--filter',
      './packages/*',
      'pack',
      '--out',
      '/runs/s/toolkit/%s.tgz',
    ]);
  });

  it('pins nothing from npm in the steered overlay', () => {
    const steered = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'experiments',
          'three-arm',
          'arms',
          'steered',
          'package.overlay.json',
        ),
        'utf8',
      ),
    ) as { devDependencies: Record<string, string> };
    expect(steered.devDependencies['legion-toolkit']).toBeUndefined();
  });

  it('steers AGENTS.md and names the lint command', () => {
    expect(STEER_INIT).toEqual([
      'legion-steer',
      'init',
      '--targets',
      'agents',
      '--lint',
      'npm run lint',
    ]);
  });
});

describe('steps', () => {
  const steps = listSteps([
    '02-any-way-you-can.md',
    '01-build.md',
    'README.txt',
    '10-compact.md',
  ]);

  it('orders the prompts by their number', () => {
    expect(steps.map((step) => step.name)).toEqual([
      '01-build',
      '02-any-way-you-can',
      '10-compact',
    ]);
  });

  it('resumes from a step by number or full name', () => {
    expect(stepsFrom(steps, '02').map((step) => step.name)).toEqual([
      '02-any-way-you-can',
      '10-compact',
    ]);
    expect(stepsFrom(steps, '10-compact')).toHaveLength(1);
    expect(() => stepsFrom(steps, '99')).toThrow('no prompt step named 99');
  });

  it('builds the same claude invocation for every arm', () => {
    expect(
      claudeArgs({
        model: 'claude-opus-5-5',
        permissionMode: 'bypassPermissions',
        resume: null,
      }),
    ).toEqual([
      '-p',
      '--output-format',
      'json',
      '--model',
      'claude-opus-5-5',
      '--permission-mode',
      'bypassPermissions',
    ]);
    expect(
      claudeArgs({
        model: 'm',
        permissionMode: 'acceptEdits',
        resume: 'abc',
      }).slice(-2),
    ).toEqual(['--resume', 'abc']);
  });

  it('tells a step result from a per-step audit', () => {
    expect(isResultFile('01-build.json')).toBe(true);
    expect(isResultFile('01-build.audit.json')).toBe(false);
    expect(isResultFile('01-build.stderr.txt')).toBe(false);
  });
});
