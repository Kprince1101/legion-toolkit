const REDIRECT = /(?:^|[^0-9&>=-])>{1,2}\s*(['"]?)([^\s'";&|<>]+)\1/g;

const TEE = /\btee\s+(?:-a\s+)?(['"]?)([^\s'";&|<>]+)\1/g;

const IN_PLACE_EDITOR = /^\s*(?:sudo\s+)?(?:sed|perl)\b/;

const IN_PLACE_FLAG = /\s-[a-zA-Z]*i/;

const COPY_OR_MOVE = /^\s*(?:cp|mv|install)\b/;

const REMOVE = /^\s*(?:sudo\s+)?(?:rm|unlink|git\s+rm)\b/;

const SCRIPT_RUNNER = /\b(?:node|python3?|bun|deno|ruby)\b/;

const SCRIPT_WRITE = /writeFile|\.write\(|open\(/;

const QUOTED_PATH = /['"`]([\w./@-]+\.[a-zA-Z]+)['"`]/g;

const SEGMENT_SEPARATOR = /&&|\|\||[;|&\n]/;

const unquote = (token: string): string => token.replace(/^['"]|['"]$/g, '');

const tokensOf = (segment: string): string[] =>
  segment
    .trim()
    .split(/\s+/)
    .map(unquote)
    .filter((token) => token.length > 0);

const captured = (pattern: RegExp, text: string): string[] =>
  [...text.matchAll(pattern)].map((match) => match[2] ?? '');

const segmentTargets = (segment: string): string[] => {
  const targets = [...captured(REDIRECT, segment), ...captured(TEE, segment)];
  if (IN_PLACE_EDITOR.test(segment) && IN_PLACE_FLAG.test(segment)) {
    targets.push(...tokensOf(segment).slice(1));
  }
  if (REMOVE.test(segment)) {
    targets.push(
      ...tokensOf(segment)
        .slice(1)
        .filter((token) => !token.startsWith('-') && token !== 'rm'),
    );
  }
  if (COPY_OR_MOVE.test(segment)) {
    const last = tokensOf(segment).at(-1);
    if (last !== undefined) targets.push(last);
  }
  if (SCRIPT_RUNNER.test(segment) && SCRIPT_WRITE.test(segment)) {
    targets.push(
      ...[...segment.matchAll(QUOTED_PATH)].map((match) => match[1] ?? ''),
    );
  }
  return targets;
};

const heredocBodiesRemoved = (command: string): string =>
  command.replace(
    /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?:\n|$)/g,
    (match) => match.slice(0, match.indexOf('\n') + 1),
  );

export const shellWriteTargets = (command: string): string[] => {
  const segments = heredocBodiesRemoved(command).split(SEGMENT_SEPARATOR);
  const targets = segments.flatMap(segmentTargets);
  return [...new Set(targets.filter((target) => target.length > 0))];
};
