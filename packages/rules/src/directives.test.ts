import type { AST } from 'eslint';
import { bareRuleName, parseDirective } from './directives.js';

const comment = (value: string): AST.Program['comments'][number] =>
  ({ type: 'Line', value }) as AST.Program['comments'][number];

describe('parseDirective', () => {
  it('parses a scoped, named, explained directive', () => {
    expect(
      parseDirective(
        comment(
          ' eslint-disable-next-line no-console, no-alert -- cli output ',
        ),
      ),
    ).toMatchObject({
      tool: 'eslint',
      kind: 'disable',
      scope: 'next-line',
      rules: ['no-console', 'no-alert'],
      description: 'cli output',
    });
  });

  it('parses file-wide and line-form directives', () => {
    expect(parseDirective(comment(' oxlint-disable '))).toMatchObject({
      scope: 'file',
      rules: [],
    });
    expect(parseDirective(comment(' eslint-disable-line no-x '))).toMatchObject(
      { scope: 'line', rules: ['no-x'] },
    );
    expect(parseDirective(comment(' eslint-enable no-x '))).toMatchObject({
      kind: 'enable',
    });
  });

  it('ignores ordinary comments and look-alikes', () => {
    expect(parseDirective(comment(' see eslint-disable docs'))).toBeNull();
    expect(parseDirective(comment(' eslint-disabled'))).toBeNull();
    expect(parseDirective(comment(' TODO'))).toBeNull();
  });
});

describe('bareRuleName', () => {
  it('strips plugin prefixes', () => {
    expect(bareRuleName('legion/no-enum')).toBe('no-enum');
    expect(bareRuleName('@typescript-eslint/no-explicit-any')).toBe(
      'no-explicit-any',
    );
    expect(bareRuleName('no-ternary')).toBe('no-ternary');
  });
});
