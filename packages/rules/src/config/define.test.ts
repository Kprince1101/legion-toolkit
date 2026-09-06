import { defineLegionConfig } from './define.js';
import { recommended, strict } from './presets.js';
import { RULE_NAMES } from '../rules/index.js';

describe('defineLegionConfig', () => {
  it('maps tolerance levels to linter severities', () => {
    const config = defineLegionConfig({
      rules: {
        'no-enum': 0,
        'no-react-fc': 1,
        'no-narrative-comments': 2,
        'no-function-keyword': 3,
      },
    });
    expect(config.oxlint.rules['legion/no-enum']).toBe('off');
    expect(config.oxlint.rules['legion/no-react-fc']).toBe('warn');
    expect(config.oxlint.rules['legion/no-narrative-comments']).toEqual([
      'error',
      {},
    ]);
    expect(config.oxlint.rules['legion/no-function-keyword']).toBe('error');
  });

  it('locks every rule at level 3 and hands the list to scoped-disables', () => {
    const config = defineLegionConfig({
      rules: { 'no-enum': 3, 'scoped-disables': 2 },
      noTernary: 3,
    });
    expect(config.locked).toEqual(
      expect.arrayContaining(['no-enum', 'no-ternary', 'max-lines']),
    );
    expect(config.locked).not.toContain('no-react-fc');
    expect(config.oxlint.rules['legion/scoped-disables']).toEqual([
      'error',
      { locked: config.locked },
    ]);
  });

  it('wires the component line cap and test file override', () => {
    const config = defineLegionConfig({ componentMaxLines: 120 });
    expect(config.oxlint.overrides[0]).toEqual({
      files: ['**/*.tsx'],
      rules: {
        'max-lines': [
          'error',
          { max: 120, skipBlankLines: true, skipComments: true },
        ],
      },
    });
    expect(config.oxlint.overrides[1]).toEqual({
      files: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**'],
      rules: { 'max-lines': 'off' },
    });
  });

  it('drops the line cap entirely when disabled', () => {
    const config = defineLegionConfig({ componentMaxLines: false });
    expect(config.levels['max-lines']).toBeUndefined();
    expect(config.oxlint.overrides.some((o) => 'max-lines' in o.rules)).toBe(
      false,
    );
  });

  it('passes comment options through', () => {
    const config = defineLegionConfig({
      rules: { 'no-narrative-comments': 2 },
      comments: { allowInEmptyBlocks: true, allowPatterns: ['^Sonar'] },
    });
    expect(config.oxlint.rules['legion/no-narrative-comments']).toEqual([
      'error',
      { allowInEmptyBlocks: true, allowPatterns: ['^Sonar'] },
    ]);
  });

  it('turns no-explicit-any off on boundary paths', () => {
    const config = defineLegionConfig({
      noExplicitAny: 2,
      anyBoundaries: ['db/**'],
    });
    expect(config.oxlint.rules['typescript/no-explicit-any']).toBe('error');
    expect(config.oxlint.overrides.at(-1)).toEqual({
      files: ['db/**'],
      rules: { 'typescript/no-explicit-any': 'off' },
    });
  });

  it('builds ESLint flat config with the plugin and optional typescript-eslint', () => {
    const plugin = { rules: {} };
    const tsPlugin = { rules: {} };
    const config = defineLegionConfig({
      rules: { 'no-enum': 2 },
      noExplicitAny: 1,
    });
    const flat = config.eslint(plugin, { typescriptEslint: tsPlugin });
    expect(flat[0]?.plugins).toEqual({ legion: plugin });
    expect(flat[0]?.rules['legion/no-enum']).toBe('error');
    expect(
      flat.find((c) => c.name === 'legion/no-explicit-any')?.rules,
    ).toEqual({
      '@typescript-eslint/no-explicit-any': 'warn',
    });
    expect(
      config.eslint(plugin).some((c) => c.name === 'legion/no-explicit-any'),
    ).toBe(false);
  });
});

describe('reactCompiler', () => {
  it('turns no-manual-memo on at the highest configured level', () => {
    const config = defineLegionConfig({
      rules: { 'no-enum': 2 },
      reactCompiler: true,
    });
    expect(config.levels['no-manual-memo']).toBe(2);
    expect(config.oxlint.rules['legion/presentational-components']).toEqual([
      'off',
      { reactCompiler: true },
    ]);
  });

  it('leaves no-manual-memo off by default and respects an explicit level', () => {
    expect(defineLegionConfig({}).levels['no-manual-memo']).toBe(0);
    expect(
      defineLegionConfig({
        rules: { 'no-manual-memo': 1 },
        reactCompiler: true,
      }).levels['no-manual-memo'],
    ).toBe(1);
  });
});

describe('presets', () => {
  it('recommended runs every rule at 2 except no-disables', () => {
    for (const name of RULE_NAMES) {
      if (name === 'no-disables' || name === 'no-manual-memo') continue;
      expect(recommended.levels[name]).toBe(2);
    }
    expect(recommended.levels['no-disables']).toBe(0);
    expect(recommended.locked).toEqual(['max-lines']);
  });

  it('strict locks every rule and warns on every bypass', () => {
    for (const name of RULE_NAMES) {
      if (name === 'no-disables' || name === 'no-manual-memo') continue;
      expect(strict.levels[name]).toBe(3);
    }
    expect(strict.levels['no-disables']).toBe(1);
    expect(strict.locked).toContain('no-narrative-comments');
    expect(strict.locked).toContain('no-ternary');
  });
});
