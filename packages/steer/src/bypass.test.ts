import {
  FILE_WIDE_RULE,
  addedDirectives,
  blindsTheLinter,
  reviewBypasses,
} from './bypass.js';
import { introduced } from './delta.js';
import type { Finding } from 'legion-audit';

const NEXT_LINE =
  '// eslint-disable-next-line legion/no-enum -- generated shape\n';

describe('addedDirectives', () => {
  it('finds only the directives the write adds', () => {
    const before = `${NEXT_LINE}export enum A {}\n`;
    const after = `${before}${NEXT_LINE}export enum B {}\n`;
    expect(addedDirectives(before, after)).toHaveLength(1);
    expect(addedDirectives(after, after)).toEqual([]);
  });
});

describe('blindsTheLinter', () => {
  it('flags a bare file-wide disable and one that turns off the bypass rules', () => {
    const [bare] = addedDirectives('', '/* eslint-disable */\n');
    const [named] = addedDirectives(
      '',
      '/* oxlint-disable legion/scoped-disables */\n',
    );
    const [scoped] = addedDirectives('', NEXT_LINE);
    expect(bare && blindsTheLinter(bare)).toBe(true);
    expect(named && blindsTheLinter(named)).toBe(true);
    expect(scoped && blindsTheLinter(scoped)).toBe(false);
  });
});

describe('reviewBypasses', () => {
  it('turns an added file-wide disable into a blocking finding', () => {
    const review = reviewBypasses(
      'src/a.ts',
      '',
      '/* eslint-disable */\nexport enum A {}\n',
    );
    expect(review.findings).toHaveLength(1);
    expect(review.findings[0]?.rule).toBe(FILE_WIDE_RULE);
    expect(review.findings[0]?.file).toBe('src/a.ts');
  });

  it('announces a scoped bypass the agent adds', () => {
    const review = reviewBypasses(
      'src/a.ts',
      '',
      `${NEXT_LINE}export enum A {}\n`,
    );
    expect(review.findings).toEqual([]);
    expect(review.notices[0]).toContain('gains a lint bypass');
    expect(review.notices[0]).toContain('legion/no-enum');
  });

  it('says so when a file it inherits is already blind', () => {
    const source = '/* eslint-disable */\nexport const a = 1;\n';
    const review = reviewBypasses(
      'src/a.ts',
      source,
      `${source}export const b = 2;\n`,
    );
    expect(review.findings).toEqual([]);
    expect(review.notices[0]).toContain('already has a file-wide bypass');
  });

  it('ignores directive-shaped text inside strings', () => {
    const review = reviewBypasses(
      'src/a.ts',
      '',
      "export const text = '/* eslint-disable */';\n",
    );
    expect(review).toEqual({ findings: [], notices: [] });
  });
});

const make = (rule: string, message: string): Finding => ({
  rule,
  message,
  file: 'a.ts',
  line: 1,
  severity: 'error',
});

describe('introduced', () => {
  it('subtracts what was already there, ignoring shifted numbers', () => {
    const before = [make('max-lines', 'File has 190 lines, max 180')];
    const after = [
      make('max-lines', 'File has 191 lines, max 180'),
      make('no-ternary', 'Unexpected use of ternary expression'),
    ];
    expect(introduced(after, before).map((f) => f.rule)).toEqual([
      'no-ternary',
    ]);
  });

  it('counts duplicates, so a second copy of an old violation is new', () => {
    const one = make('legion/no-enum', 'no enum');
    expect(introduced([one, one], [one])).toHaveLength(1);
  });
});
