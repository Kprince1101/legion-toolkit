import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type MarkerStatus = 'checked' | 'deferred' | 'started';

export interface Marker {
  status: MarkerStatus;
  at: number;
  original: string;
  head?: string;
}

export interface MarkerKeySource {
  tool_use_id?: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: unknown;
}

export const STATE_DIR = join(tmpdir(), 'legion-steer');

export const markerKey = (source: MarkerKeySource): string => {
  if (source.tool_use_id !== undefined && source.tool_use_id.length > 0) {
    return source.tool_use_id.replace(/[^A-Za-z0-9_-]/g, '_');
  }
  return createHash('sha256')
    .update(
      JSON.stringify([
        source.session_id ?? '',
        source.tool_name ?? '',
        source.tool_input ?? null,
      ]),
    )
    .digest('hex');
};

const markerPath = (source: MarkerKeySource): string =>
  join(STATE_DIR, `${markerKey(source)}.json`);

export const writeMarker = (
  source: MarkerKeySource,
  marker: Marker,
): boolean => {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(markerPath(source), JSON.stringify(marker));
    return true;
  } catch {
    return false;
  }
};

export const takeMarker = (source: MarkerKeySource): Marker | null => {
  const path = markerPath(source);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Marker;
  } catch {
    return null;
  } finally {
    rmSync(path, { force: true });
  }
};
