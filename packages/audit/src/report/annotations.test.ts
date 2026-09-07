import { annotation } from './annotations.js';
import type { Finding } from '../types.js';

const finding = (over: Partial<Finding> = {}): Finding => ({
  rule: 'legion/no-enum',
  file: 'src/a.ts',
  line: 12,
  message: 'enum Status is not allowed',
  severity: 'error',
  ...over,
});

describe('annotation', () => {
  it('emits the workflow command GitHub renders on the diff', () => {
    expect(annotation(finding())).toBe(
      '::error file=src/a.ts,line=12,title=legion/no-enum::enum Status is not allowed',
    );
  });

  it('maps a warning to a warning annotation', () => {
    expect(annotation(finding({ severity: 'warning' }))).toContain(
      '::warning ',
    );
  });

  it('escapes the characters that would break the command', () => {
    const output = annotation(
      finding({ message: 'a: b, c\nd', file: 'src/x,y.ts' }),
    );
    expect(output).toContain('%3A');
    expect(output).toContain('%2C');
    expect(output).toContain('%0A');
    expect(output).not.toContain('\n');
  });
});
