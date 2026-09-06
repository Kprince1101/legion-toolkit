import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strict } from 'legion-rules';

const root = resolve(import.meta.dirname, '..');
const target = resolve(root, '.oxlintrc.json');
const checkOnly = process.argv.includes('--check');

const config = {
  $schema: './node_modules/oxlint/configuration_schema.json',
  ...strict.oxlint,
  ignorePatterns: [
    'node_modules/**',
    '**/dist/**',
    'coverage/**',
    '.yarn/**',
    'fixtures/**',
    '**/*.d.ts',
  ],
};

const next = `${JSON.stringify(config, null, 2)}\n`;
let current = '';
try {
  current = readFileSync(target, 'utf8');
} catch {
  current = '';
}

if (checkOnly) {
  if (current !== next) {
    console.error('.oxlintrc.json is out of date; run `yarn sync:oxlintrc`.');
    process.exit(1);
  }
  console.log('.oxlintrc.json is in sync with the strict preset');
  process.exit(0);
}

writeFileSync(target, next);
console.log('.oxlintrc.json written from the strict preset');
