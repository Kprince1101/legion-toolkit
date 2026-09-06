import { isFileWideDisable, parseDirectivesInSource } from './directives.js';

describe('parseDirectivesInSource', () => {
  it('finds every directive shape with its line', () => {
    const source = [
      '/* eslint-disable */',
      '// eslint-disable-next-line no-console -- cli output',
      'console.log(1); // oxlint-disable-line no-console',
      '/* eslint-disable no-alert, no-console */',
      '/* eslint-enable no-alert */',
      'const x = 1; // NOSONAR',
    ].join('\n');
    const { hits, nosonar } = parseDirectivesInSource('a.ts', source);
    expect(
      hits.map((hit) => [
        hit.line,
        hit.tool,
        hit.kind,
        hit.scope,
        hit.rules,
        hit.description,
      ]),
    ).toEqual([
      [1, 'eslint', 'disable', 'file', [], ''],
      [2, 'eslint', 'disable', 'next-line', ['no-console'], 'cli output'],
      [3, 'oxlint', 'disable', 'line', ['no-console'], ''],
      [4, 'eslint', 'disable', 'file', ['no-alert', 'no-console'], ''],
      [5, 'eslint', 'enable', 'file', ['no-alert'], ''],
    ]);
    expect(nosonar).toEqual([{ file: 'a.ts', line: 6 }]);
  });

  it('ignores prose that mentions the directive', () => {
    const { hits } = parseDirectivesInSource(
      'a.ts',
      'const doc = "see eslint-disable in docs";',
    );
    expect(hits).toEqual([]);
  });

  it('ignores directive-shaped text inside string literals', () => {
    const source = [
      "const code = '/* eslint-disable */';",
      'const other = "// eslint-disable-next-line x";',
      'const tpl = `// oxlint-disable`;',
      "const real = 1; // eslint-disable-line no-x -- after a string 'quoted'",
    ].join('\n');
    const { hits } = parseDirectivesInSource('a.ts', source);
    expect(hits.map((hit) => hit.line)).toEqual([4]);
  });
});

describe('isFileWideDisable', () => {
  it('only matches a bare disable with no rule list', () => {
    const { hits } = parseDirectivesInSource(
      'a.ts',
      '/* eslint-disable */\n/* eslint-disable no-x */\n// eslint-disable-next-line',
    );
    expect(hits.map(isFileWideDisable)).toEqual([true, false, false]);
  });
});
