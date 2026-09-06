import rule, { normalizeComment } from './no-narrative-comments.js';
import { runRule } from '../test-utils.js';

runRule('no-narrative-comments', rule, {
  valid: [
    { code: 'export const a = 1;' },
    {
      code: '// eslint-disable-next-line no-console -- cli output\nconsole.log(1);',
    },
    {
      code: '// oxlint-disable-next-line no-console -- cli output\nconsole.log(1);',
    },
    { code: '// @ts-expect-error legacy types\nexport const a: number = "x";' },
    { code: '/** @jest-environment node */\nexport const a = 1;' },
    { code: '/* istanbul ignore next */\nexport const a = 1;' },
    { code: '// prettier-ignore\nexport const   a = 1;' },
    { code: '/// <reference types="node" />\nexport const a = 1;' },
    { code: 'export const a = 1; // NOSONAR' },
    { code: 'export const a = /* @__PURE__ */ Object.freeze({});' },
    {
      code: 'const lazy = () => import(/* webpackChunkName: "panel" */ "./panel");',
    },
    {
      code: '// biome-ignore lint/suspicious/noExplicitAny: shim\nexport const a = 1;',
    },
    {
      code: 'export const noop = () => {\n  /* intentionally empty */\n};',
      options: [{ allowInEmptyBlocks: true }],
    },
    {
      code: '// Sonar: S1186 requires this\nexport const a = 1;',
      options: [{ allowPatterns: ['^Sonar:'] }],
    },
  ],
  invalid: [
    {
      code: '// renders the header\nexport const a = 1;',
      errors: [{ messageId: 'commentNotAllowed' }],
    },
    {
      code: '/**\n * Header component.\n */\nexport const a = 1;',
      errors: [{ messageId: 'commentNotAllowed' }],
    },
    {
      code: 'export const a = 1; // TODO: remove',
      errors: [{ messageId: 'commentNotAllowed' }],
    },
    {
      code: '// ── Economy ───────────\nexport const a = 1;',
      errors: [{ messageId: 'commentNotAllowed' }],
    },
    {
      code: 'export const noop = () => {\n  /* intentionally empty */\n};',
      errors: [{ messageId: 'commentNotAllowed' }],
    },
    {
      code: 'export const a = () => {\n  /* not empty */\n  return 1;\n};',
      options: [{ allowInEmptyBlocks: true }],
      errors: [{ messageId: 'commentNotAllowed' }],
    },
  ],
});

describe('normalizeComment', () => {
  it('collapses block comment decoration and whitespace', () => {
    expect(normalizeComment('*\n * @jest-environment node\n ')).toBe(
      '@jest-environment node',
    );
  });
});
