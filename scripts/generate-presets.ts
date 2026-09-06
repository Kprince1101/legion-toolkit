import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reactNative, recommended, strict } from 'legion-rules';
import type { LegionConfig } from 'legion-rules';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, 'packages', 'toolkit', 'presets');

const PRESETS: Array<[string, LegionConfig]> = [
  ['recommended', recommended],
  ['strict', strict],
  ['react-native', reactNative],
];

mkdirSync(outDir, { recursive: true });

for (const [name, config] of PRESETS) {
  const target = resolve(outDir, `${name}.json`);
  writeFileSync(target, `${JSON.stringify(config.oxlint, null, 2)}\n`);
}

console.log(
  `wrote ${PRESETS.length} oxlint presets to packages/toolkit/presets`,
);
