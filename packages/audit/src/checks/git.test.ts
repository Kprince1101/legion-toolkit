import { summarizePrHygiene } from './git.js';

describe('summarizePrHygiene', () => {
  it('counts squash-merge PR numbers and finds the latest', () => {
    const lines = [
      'aaa 2026-09-05 Fix header (#12)',
      'bbb 2026-09-04 Strip comments',
      'ccc 2026-09-03 Add audit (#11)',
      'ddd 2026-09-02 wip',
    ];
    expect(summarizePrHygiene(lines, 80)).toEqual({
      status: 'pass',
      inspected: 4,
      withPr: 2,
      ratio: 0.5,
      lastPrCommit: 'aaa 2026-09-05 Fix header (#12)',
    });
  });

  it('fails below half and handles an empty history', () => {
    expect(summarizePrHygiene(['a x', 'b y', 'c z'], 80).status).toBe('fail');
    expect(summarizePrHygiene([], 80)).toMatchObject({
      withPr: 0,
      ratio: 0,
      lastPrCommit: null,
    });
  });
});
