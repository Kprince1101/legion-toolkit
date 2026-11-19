import { applyEdit, applyEdits, pendingContent } from './edits.js';

describe('applyEdit', () => {
  it('replaces the single occurrence, the way Edit does', () => {
    expect(
      applyEdit('const a = 1;\nconst b = 2;\n', {
        old_string: 'const b = 2;',
        new_string: 'const b = 3;',
      }),
    ).toEqual({ ok: true, content: 'const a = 1;\nconst b = 3;\n' });
  });

  it('does not treat $ in the replacement as a pattern', () => {
    expect(applyEdit('x', { old_string: 'x', new_string: '$&$1' })).toEqual({
      ok: true,
      content: '$&$1',
    });
  });

  it('replaces every occurrence only when replace_all is set', () => {
    expect(
      applyEdit('a a a', {
        old_string: 'a',
        new_string: 'b',
        replace_all: true,
      }),
    ).toEqual({ ok: true, content: 'b b b' });
    const refused = applyEdit('a a', { old_string: 'a', new_string: 'b' });
    expect(refused.ok).toBe(false);
  });

  it('refuses an old_string that is not there, as Edit would', () => {
    const applied = applyEdit('abc', { old_string: 'zzz', new_string: 'y' });
    expect(applied).toEqual({
      ok: false,
      reason: 'old_string was not found in the file',
    });
  });

  it('creates a file from an empty old_string', () => {
    expect(applyEdit('', { old_string: '', new_string: 'new' })).toEqual({
      ok: true,
      content: 'new',
    });
  });
});

describe('applyEdits', () => {
  it('applies MultiEdit edits in order, each on the result of the last', () => {
    expect(
      applyEdits('one', [
        { old_string: 'one', new_string: 'two' },
        { old_string: 'two', new_string: 'three' },
      ]),
    ).toEqual({ ok: true, content: 'three' });
  });

  it('names the edit that could not be applied', () => {
    const applied = applyEdits('one', [
      { old_string: 'one', new_string: 'two' },
      { old_string: 'missing', new_string: 'x' },
    ]);
    expect(applied.ok).toBe(false);
    if (applied.ok) return;
    expect(applied.reason).toContain('edit 2 of 2');
  });
});

describe('pendingContent', () => {
  it('reads Write content straight from the payload', () => {
    expect(pendingContent('Write', { content: 'x' }, 'old')).toEqual({
      ok: true,
      content: 'x',
    });
  });

  it('applies Edit and MultiEdit to the file on disk', () => {
    expect(
      pendingContent('Edit', { old_string: 'a', new_string: 'b' }, 'a'),
    ).toEqual({ ok: true, content: 'b' });
    expect(
      pendingContent(
        'MultiEdit',
        { edits: [{ old_string: 'a', new_string: 'b' }] },
        'a',
      ),
    ).toEqual({ ok: true, content: 'b' });
  });

  it('says it does not know a tool instead of guessing', () => {
    expect(pendingContent('Mystery', {}, '').ok).toBe(false);
  });
});
