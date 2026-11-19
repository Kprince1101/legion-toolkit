import { relative } from 'node:path';

export const firstLine = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? 'no output';

export const displayPath = (root: string, absolute: string): string => {
  const shown = relative(root, absolute);
  if (shown.length === 0) return absolute;
  return shown;
};
