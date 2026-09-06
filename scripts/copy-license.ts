import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
copyFileSync(resolve(root, 'LICENSE'), resolve(process.cwd(), 'LICENSE'));
