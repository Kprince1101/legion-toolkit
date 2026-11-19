import { shellWriteTargets } from './shell.ts';

describe('shellWriteTargets', () => {
  it('finds a redirect and a heredoc target', () => {
    expect(
      shellWriteTargets(
        "cat > app/stats/page.tsx <<'EOF'\nconst x = a > b;\nEOF",
      ),
    ).toEqual(['app/stats/page.tsx']);
  });

  it('finds tee, in-place edits, copies and removals', () => {
    expect(shellWriteTargets('echo x | tee -a lib/a.ts')).toEqual(['lib/a.ts']);
    expect(shellWriteTargets("sed -i '' 's/a/b/' app/page.tsx")).toContain(
      'app/page.tsx',
    );
    expect(shellWriteTargets('cp /tmp/x.tsx app/x.tsx')).toEqual(['app/x.tsx']);
    expect(shellWriteTargets('rm -f .oxlintrc.json')).toEqual([
      '.oxlintrc.json',
    ]);
  });

  it('finds a file written by an inline script', () => {
    expect(
      shellWriteTargets(
        `node -e "require('fs').writeFileSync('app/a.tsx', src)"`,
      ),
    ).toContain('app/a.tsx');
  });

  it('ignores reads, stderr redirects and arrows', () => {
    expect(shellWriteTargets('npx tsc --noEmit 2>&1 | head')).toEqual([]);
    expect(shellWriteTargets('sed -n 1,20p app/page.tsx')).toEqual([]);
    expect(shellWriteTargets('cat app/page.tsx')).toEqual([]);
    expect(shellWriteTargets(`node -e "[1].map((x) => x)"`)).toEqual([]);
  });
});
