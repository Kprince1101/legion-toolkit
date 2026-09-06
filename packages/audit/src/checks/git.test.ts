import { forgeFromRemote, forgeLabel, forgePattern } from './forge.js';
import { summarizePrHygiene } from './git.js';

describe('forgeFromRemote', () => {
  it('reads the host out of ssh and https remotes alike', () => {
    expect(forgeFromRemote('git@github.com:acme/app.git')).toBe('github');
    expect(forgeFromRemote('https://github.com/acme/app.git')).toBe('github');
    expect(forgeFromRemote('git@gitlab.com:acme/app.git')).toBe('gitlab');
    expect(forgeFromRemote('https://gitlab.acme.internal/x/y.git')).toBe(
      'gitlab',
    );
    expect(forgeFromRemote('git@bitbucket.org:acme/app.git')).toBe('bitbucket');
    expect(forgeFromRemote('https://dev.azure.com/acme/app/_git/app')).toBe(
      'azure',
    );
  });

  it('is unknown for a host it does not recognize', () => {
    expect(forgeFromRemote('git@git.example.com:acme/app.git')).toBe('unknown');
    expect(forgePattern('unknown')).toBeNull();
    expect(forgeLabel('unknown')).toBe('an unrecognized host');
  });
});

describe('summarizePrHygiene', () => {
  it('counts GitHub squash-merge numbers and finds the latest', () => {
    const lines = [
      'aaa 2026-09-05 Fix header (#12)',
      'bbb 2026-09-04 Strip comments',
      'ccc 2026-09-03 Add audit (#11)',
      'ddd 2026-09-02 wip',
    ];
    expect(summarizePrHygiene(lines, 80, 'github')).toEqual({
      status: 'pass',
      inspected: 4,
      withPr: 2,
      ratio: 0.5,
      lastPrCommit: 'aaa 2026-09-05 Fix header (#12)',
      forge: 'github',
    });
  });

  it('reads a GitLab merge request out of the commit body, not the subject', () => {
    const lines = [
      "aaa 2026-09-05 Merge branch 'feat' into 'main' See merge request acme/app!42",
      'bbb 2026-09-04 wip',
    ];
    const result = summarizePrHygiene(lines, 80, 'gitlab');
    expect(result.withPr).toBe(1);
    expect(result.forge).toBe('gitlab');
  });

  it('reads a Bitbucket pull request marker', () => {
    const lines = ['aaa 2026-09-05 Merged in feat/x (pull request #7)'];
    expect(summarizePrHygiene(lines, 80, 'bitbucket').withPr).toBe(1);
  });

  it('reads an Azure DevOps merge subject', () => {
    const lines = ['aaa 2026-09-05 Merged PR 91: Add the widget'];
    expect(summarizePrHygiene(lines, 80, 'azure').withPr).toBe(1);
  });

  it('does not score a GitLab history against the GitHub convention', () => {
    const gitlab = [
      'aaa Merge branch x into main See merge request acme/app!42',
    ];
    expect(summarizePrHygiene(gitlab, 80, 'github').withPr).toBe(0);
    expect(summarizePrHygiene(gitlab, 80, 'gitlab').withPr).toBe(1);
  });

  it('skips entirely on an unrecognized host rather than reporting zero', () => {
    const result = summarizePrHygiene(['aaa Fix header (#12)'], 80, 'unknown');
    expect(result.status).toBe('skipped');
    expect(result.ratio).toBe(0);
  });

  it('fails below half and handles an empty history', () => {
    expect(summarizePrHygiene(['a x', 'b y', 'c z'], 80, 'github').status).toBe(
      'fail',
    );
    expect(summarizePrHygiene([], 80, 'github')).toMatchObject({
      withPr: 0,
      ratio: 0,
      lastPrCommit: null,
    });
  });
});
