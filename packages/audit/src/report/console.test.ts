import { renderConsole, wrap } from './console.js';
import type { AuditResult } from '../types.js';

describe('wrap', () => {
  it('labels the first line and indents the rest', () => {
    expect(wrap('one two three four', 9, 'why  ', '     ')).toEqual([
      'why  one two',
      '     three',
      '     four',
    ]);
  });

  it('never splits a word that is longer than the width', () => {
    expect(wrap('supercalifragilistic', 5, '', '')).toEqual([
      'supercalifragilistic',
    ]);
  });
});

const result = (advice: AuditResult['advice']): AuditResult =>
  ({
    score: 71,
    gates: [{ name: 'lint', status: 'fail', summary: '' }],
    advice,
  }) as AuditResult;

describe('renderConsole', () => {
  it('says so when there is nothing to nudge about', () => {
    const output = renderConsole(result([]));
    expect(output).toContain('No nudges.');
  });

  it('groups by area and states that nothing here failed the build', () => {
    const output = renderConsole(
      result([
        {
          id: 'yarn-classic',
          area: 'toolchain',
          title: 'On Yarn 1.',
          why: 'Berry pins the toolchain.',
          fix: ['corepack enable'],
          detail: [],
        },
        {
          id: 'missing-tests',
          area: 'tests',
          title: 'No tests.',
          why: 'A feature without tests is incomplete.',
          fix: ['write one'],
          detail: ['src/App.tsx'],
        },
      ]),
    );
    expect(output).toContain('TOOLCHAIN');
    expect(output).toContain('TESTS');
    expect(output).toContain('lint failing');
    expect(output).toContain('None of these failed the build.');
    expect(output.indexOf('TOOLCHAIN')).toBeLessThan(output.indexOf('TESTS'));
  });
});
