import {
  parseAcceptance,
  parseStepResult,
  summarizeAudit,
  totalCost,
} from './reports.ts';

describe('parseStepResult', () => {
  it('reads the cost, session and turns from a headless result', () => {
    const step = parseStepResult(
      '01-build',
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        session_id: 'abc',
        total_cost_usd: 1.25,
        duration_ms: 9000,
        num_turns: 40,
      }),
    );
    expect(step).toEqual({
      step: '01-build',
      ok: true,
      subtype: 'success',
      sessionId: 'abc',
      costUsd: 1.25,
      durationMs: 9000,
      turns: 40,
    });
  });

  it('marks an unreadable result as failed', () => {
    expect(parseStepResult('02', '').ok).toBe(false);
    expect(parseStepResult('02', '').subtype).toBe('unparseable');
  });

  it('sums the costs it has and says when it has none', () => {
    const paid = parseStepResult('a', JSON.stringify({ total_cost_usd: 1 }));
    const free = parseStepResult('b', JSON.stringify({}));
    expect(totalCost([paid, paid, free])).toBe(2);
    expect(totalCost([free])).toBeNull();
  });
});

describe('parseAcceptance', () => {
  it('counts results and names the failing specs', () => {
    const summary = parseAcceptance(
      JSON.stringify({
        stats: { expected: 20, unexpected: 2, flaky: 1, skipped: 0 },
        suites: [
          {
            title: 'stats.spec.ts',
            specs: [],
            suites: [
              {
                title: 'stats',
                specs: [
                  { title: 'the totals add up', ok: false },
                  { title: 'a new account has empty stats', ok: true },
                ],
              },
            ],
          },
        ],
        errors: [{ message: 'webServer exited early\nstack' }],
      }),
    );
    expect(summary).toEqual({
      ran: true,
      passed: 20,
      failed: 2,
      flaky: 1,
      skipped: 0,
      total: 23,
      failures: ['stats.spec.ts › stats › the totals add up'],
      errors: ['webServer exited early'],
    });
  });

  it('reports an unreadable report as not run', () => {
    expect(parseAcceptance('nope').ran).toBe(false);
  });
});

describe('summarizeAudit', () => {
  it('pulls the counts the summary table needs', () => {
    const summary = summarizeAudit(
      JSON.stringify({
        score: 71,
        lint: {
          status: 'fail',
          errors: 9,
          warnings: 3,
          rules: [
            { rule: 'no-ternary', errors: 2, warnings: 0 },
            {
              rule: 'legion/presentational-components',
              errors: 7,
              warnings: 0,
            },
          ],
          legion: [{}, {}, {}, {}, {}, {}, {}],
          componentCap: [{}],
        },
        directives: {
          all: [{ kind: 'disable' }, { kind: 'enable' }, { kind: 'disable' }],
          fileWide: [{}],
          byRule: { 'max-lines': 1 },
        },
        testCoverage: { missing: [{}, {}] },
      }),
    );
    expect(summary).toEqual({
      score: 71,
      lintStatus: 'fail',
      lintErrors: 9,
      lintWarnings: 3,
      legionFindings: 7,
      componentCap: 1,
      topRules: [
        { rule: 'legion/presentational-components', errors: 7, warnings: 0 },
        { rule: 'no-ternary', errors: 2, warnings: 0 },
      ],
      directives: 2,
      fileWideDirectives: 1,
      directivesByRule: { 'max-lines': 1 },
      untested: 2,
    });
  });
});
