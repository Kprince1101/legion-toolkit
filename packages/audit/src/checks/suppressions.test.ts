import {
  applySuppressions,
  buildSuppressions,
  suppressionKey,
} from './suppressions.js';
import type { Finding } from '../types.js';

const finding = (rule: string, file: string): Finding => ({
  rule,
  file,
  line: 1,
  message: '',
  severity: 'error',
});

describe('buildSuppressions', () => {
  it('counts findings per rule and file', () => {
    const file = buildSuppressions([
      finding('legion/no-hardcoded-hex', 'a.tsx'),
      finding('legion/no-hardcoded-hex', 'a.tsx'),
      finding('legion/no-enum', 'b.ts'),
    ]);
    expect(file.counts).toEqual({
      'legion/no-hardcoded-hex a.tsx': 2,
      'legion/no-enum b.ts': 1,
    });
  });
});

describe('applySuppressions', () => {
  const accepted = buildSuppressions([
    finding('legion/no-hardcoded-hex', 'a.tsx'),
    finding('legion/no-hardcoded-hex', 'a.tsx'),
  ]);

  it('accepts exactly the recorded count and no more', () => {
    const result = applySuppressions(
      [
        finding('legion/no-hardcoded-hex', 'a.tsx'),
        finding('legion/no-hardcoded-hex', 'a.tsx'),
      ],
      accepted,
    );
    expect(result.findings).toEqual([]);
    expect(result.suppressed).toBe(2);
  });

  it('lets a third one through, so the file cannot get worse', () => {
    const result = applySuppressions(
      [
        finding('legion/no-hardcoded-hex', 'a.tsx'),
        finding('legion/no-hardcoded-hex', 'a.tsx'),
        finding('legion/no-hardcoded-hex', 'a.tsx'),
      ],
      accepted,
    );
    expect(result.findings).toHaveLength(1);
    expect(result.suppressed).toBe(2);
  });

  it('does not carry a budget across files', () => {
    const result = applySuppressions(
      [finding('legion/no-hardcoded-hex', 'other.tsx')],
      accepted,
    );
    expect(result.findings).toHaveLength(1);
    expect(result.suppressed).toBe(0);
  });

  it('reports a suppression nothing matched, so the file can be trimmed', () => {
    const result = applySuppressions([], accepted);
    expect(result.stale).toEqual(['legion/no-hardcoded-hex a.tsx']);
  });

  it('is a no-op when nothing is recorded', () => {
    const findings = [finding('legion/no-enum', 'b.ts')];
    const result = applySuppressions(findings, { schema: 1, counts: {} });
    expect(result.findings).toEqual(findings);
    expect(result.suppressed).toBe(0);
  });
});

describe('suppressionKey', () => {
  it('keys on rule and file together', () => {
    expect(suppressionKey(finding('legion/no-enum', 'a.ts'))).toBe(
      'legion/no-enum a.ts',
    );
  });
});
