import { renderBlock, START, END } from './block.js';
import { mergeBlock } from './managed.js';
import { resolveTargets } from './targets.js';
import { reactNative, recommended } from 'legion-rules';

const block = (config = recommended): string =>
  renderBlock({ config, lintCommand: 'yarn lint', componentCap: 180 });

describe('renderBlock', () => {
  it('lists only rules the config actually enforces', () => {
    const web = block();
    expect(web).toContain('legion/button-has-type');
    expect(web).not.toContain('legion/no-rn-button');
  });

  it('follows the preset, so react native steering differs from web', () => {
    const native = block(reactNative);
    expect(native).toContain('legion/no-rn-button');
    expect(native).toContain('legion/controlled-text-input');
    expect(native).not.toContain('legion/button-has-type');
  });

  it('names the locked rules and the bypass syntax', () => {
    const strictish = block();
    expect(strictish).toContain('eslint-disable-next-line <rule> -- <reason>');
    expect(strictish).toContain('Locked rules');
  });

  it('points at the standards rather than reproducing them', () => {
    expect(block()).toContain('does not reproduce');
  });
});

describe('mergeBlock', () => {
  it('creates the file when there is nothing there', () => {
    const result = mergeBlock('', block());
    expect(result.outcome).toBe('created');
  });

  it('appends below content it did not write', () => {
    const result = mergeBlock('# My repo\n\nSome notes.\n', block());
    expect(result.outcome).toBe('appended');
    expect(result.contents).toContain('# My repo');
    expect(result.contents).toContain('Some notes.');
  });

  it('replaces only between the markers, leaving the rest alone', () => {
    const existing = `# Mine\n\n${START}\nold\n${END}\n\n## Also mine\n`;
    const result = mergeBlock(existing, block());
    expect(result.outcome).toBe('replaced');
    expect(result.contents).toContain('# Mine');
    expect(result.contents).toContain('## Also mine');
    expect(result.contents).not.toContain('old');
  });

  it('is a no-op when the block is already current', () => {
    const first = mergeBlock('', block()).contents;
    expect(mergeBlock(first, block()).outcome).toBe('unchanged');
  });
});

describe('resolveTargets', () => {
  it('falls back to AGENTS.md when nothing is detected', () => {
    const targets = resolveTargets('/nonexistent', []);
    expect(targets.map((t) => t.id)).toEqual(['agents']);
  });

  it('honors an explicit selection', () => {
    const targets = resolveTargets('/nonexistent', ['cursor', 'junie']);
    expect(targets.map((t) => t.id).sort()).toEqual(['cursor', 'junie']);
  });
});
