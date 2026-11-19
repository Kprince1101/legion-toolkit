import { isFileWideDisable, parseDirectivesInSource } from 'legion-audit';
import type { DirectiveHit, Finding } from 'legion-audit';

export const FILE_WIDE_RULE = 'legion-steer/file-wide-disable';

const BLINDING_RULES = ['scoped-disables', 'no-disables'];

const SCOPE_SUFFIX: Record<DirectiveHit['scope'], string> = {
  file: '',
  'next-line': '-next-line',
  line: '-line',
};

export interface BypassReview {
  findings: Finding[];
  notices: string[];
}

const disablesIn = (source: string): DirectiveHit[] =>
  parseDirectivesInSource('', source).hits.filter(
    (hit) => hit.kind === 'disable',
  );

const signature = (hit: DirectiveHit): string =>
  [hit.tool, hit.scope, hit.rules.join(','), hit.description].join('|');

const addedAmong = (
  before: DirectiveHit[],
  after: DirectiveHit[],
): DirectiveHit[] => {
  const remaining = new Map<string, number>();
  for (const hit of before) {
    const key = signature(hit);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  return after.filter((hit) => {
    const key = signature(hit);
    const left = remaining.get(key) ?? 0;
    if (left === 0) return true;
    remaining.set(key, left - 1);
    return false;
  });
};

export const addedDirectives = (
  before: string,
  after: string,
): DirectiveHit[] => addedAmong(disablesIn(before), disablesIn(after));

export const blindsTheLinter = (hit: DirectiveHit): boolean => {
  if (hit.scope !== 'file') return false;
  if (isFileWideDisable(hit)) return true;
  return hit.rules.some((rule) =>
    BLINDING_RULES.some((name) => rule.endsWith(name)),
  );
};

const rulesOf = (hit: DirectiveHit): string => {
  if (hit.rules.length === 0) return 'every rule';
  return hit.rules.join(', ');
};

export const describeDirective = (hit: DirectiveHit): string =>
  `line ${hit.line}: ${hit.tool}-disable${SCOPE_SUFFIX[hit.scope]} (${rulesOf(hit)})`;

const blockingFinding = (file: string, hit: DirectiveHit): Finding => ({
  rule: FILE_WIDE_RULE,
  file,
  line: hit.line,
  message: `${describeDirective(hit)} hides rules from the linter for the whole file, so legion-steer cannot check it. Bypass one line with "eslint-disable-next-line <rule> -- <reason>", or fix the code.`,
  severity: 'error',
});

export const reviewBypasses = (
  file: string,
  before: string,
  after: string,
): BypassReview => {
  const present = disablesIn(after);
  const added = addedAmong(disablesIn(before), present);
  const addedKeys = new Set(added);
  const findings = added
    .filter(blindsTheLinter)
    .map((hit) => blockingFinding(file, hit));
  const notices = added
    .filter((hit) => !blindsTheLinter(hit))
    .map(
      (hit) =>
        `${file} gains a lint bypass at ${describeDirective(hit)}; the lint config allows it, so it was not blocked`,
    );
  const inherited = present
    .filter((hit) => !addedKeys.has(hit) && blindsTheLinter(hit))
    .map(
      (hit) =>
        `${file} already has a file-wide bypass at ${describeDirective(hit)}, so the linter cannot see what it hides and that part was not checked`,
    );
  return { findings, notices: [...notices, ...inherited] };
};
