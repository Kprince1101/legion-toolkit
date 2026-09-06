import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuredFromOxlint, summarizeCoverage } from './rule-coverage.js';

const repo = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), 'legion-rc-'));
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, contents);
  }
  return root;
};

describe('configuredFromOxlint', () => {
  it('lists only the legion rules the config names', () => {
    const root = repo({
      '.oxlintrc.json': JSON.stringify({
        jsPlugins: ['legion-toolkit/eslint-plugin'],
        rules: {
          'legion/no-enum': 'error',
          'legion/no-react-fc': 'error',
          'no-ternary': 'error',
        },
      }),
    });
    expect(configuredFromOxlint(root)).toEqual(['no-enum', 'no-react-fc']);
  });

  it('returns null when there is no oxlint config to read', () => {
    expect(configuredFromOxlint(repo({}))).toBeNull();
  });

  it('survives comments in a jsonc config', () => {
    const root = repo({
      '.oxlintrc.json':
        '{\n  // the plugin\n  "rules": { "legion/no-enum": "error" }\n}',
    });
    expect(configuredFromOxlint(root)).toEqual(['no-enum']);
  });
});

describe('summarizeCoverage', () => {
  it('names the rules the installed plugin ships that the config never mentions', () => {
    const result = summarizeCoverage(
      ['button-has-type', 'no-enum', 'no-hardcoded-hex', 'no-react-fc'],
      ['no-enum', 'no-react-fc'],
      'oxlint',
    );
    expect(result.status).toBe('checked');
    expect(result.unconfigured).toEqual([
      'button-has-type',
      'no-hardcoded-hex',
    ]);
    expect(result.configured).toHaveLength(2);
    expect(result.source).toBe('oxlint');
  });

  it('reports nothing missing when the config covers everything', () => {
    const result = summarizeCoverage(['no-enum'], ['no-enum'], 'eslint');
    expect(result.unconfigured).toEqual([]);
  });

  it('does not care about a configured rule the installed plugin no longer ships', () => {
    const result = summarizeCoverage(
      ['no-enum'],
      ['no-enum', 'no-boolean-request-state'],
      'oxlint',
    );
    expect(result.unconfigured).toEqual([]);
  });
});

describe('probeFile', () => {
  it('prefers a tsx file but falls back to any source, so a backend is not skipped', async () => {
    const { probeFile } = await import('../audit.js');
    const tsxRepo = repo({
      'src/App.tsx': 'export const A = () => null;',
      'src/util.ts': 'export const a = 1;',
    });
    expect(probeFile(tsxRepo, [])).toContain('.tsx');
    const backend = repo({
      'src/server.ts': 'export const a = 1;',
      'src/db.ts': 'export const b = 2;',
    });
    expect(probeFile(backend, [])).toContain('.ts');
  });
});
