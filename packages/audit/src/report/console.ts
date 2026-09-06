import type { Advice, AdviceArea, AuditResult } from '../types.js';

const AREA_HEADINGS: Record<AdviceArea, string> = {
  toolchain: 'TOOLCHAIN',
  rules: 'RULES',
  tests: 'TESTS',
  bypasses: 'BYPASSES',
  process: 'PROCESS',
};

const AREA_ORDER: AdviceArea[] = [
  'toolchain',
  'rules',
  'tests',
  'bypasses',
  'process',
];

const WIDTH = 72;
const INDENT = '  ';
const LABEL = '    ';

export const wrap = (
  text: string,
  width: number,
  first: string,
  rest: string,
): string[] => {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = [current, word]
      .filter((part) => part.length > 0)
      .join(' ');
    if (candidate.length > width && current.length > 0) {
      chunks.push(current);
      current = word;
      continue;
    }
    current = candidate;
  }
  if (current.length > 0) chunks.push(current);
  return chunks.map((chunk, index) => {
    if (index === 0) return first + chunk;
    return rest + chunk;
  });
};

const renderEntry = (entry: Advice): string[] => {
  const lines = [`${INDENT}${entry.title}`];
  lines.push(
    ...wrap(
      entry.why,
      WIDTH - LABEL.length - 5,
      `${LABEL}why  `,
      `${LABEL}     `,
    ),
  );
  for (const step of entry.fix) lines.push(`${LABEL}fix  ${step}`);
  for (const detail of entry.detail) lines.push(`${LABEL}     ${detail}`);
  return lines;
};

const renderArea = (area: AdviceArea, entries: Advice[]): string[] => {
  if (entries.length === 0) return [];
  const lines = [`${AREA_HEADINGS[area]}`];
  for (const entry of entries) {
    lines.push(...renderEntry(entry));
    lines.push('');
  }
  return lines;
};

const gateLine = (result: AuditResult): string => {
  const failed = result.gates.filter((gate) => gate.status === 'fail');
  if (failed.length === 0) return 'all gates green';
  return `${failed.map((gate) => gate.name).join(', ')} failing`;
};

export const renderConsole = (result: AuditResult): string => {
  const lines = [
    '',
    `legion-audit: score ${result.score}/100, ${gateLine(result)}`,
    '',
  ];
  if (result.advice.length === 0) {
    lines.push('No nudges. This repo is set up the way Legion ships.');
    lines.push('');
    return lines.join('\n');
  }
  for (const area of AREA_ORDER) {
    const entries = result.advice.filter((entry) => entry.area === area);
    lines.push(...renderArea(area, entries));
  }
  lines.push(
    `${result.advice.length} nudge(s). None of these failed the build.`,
    '',
  );
  return lines.join('\n');
};
