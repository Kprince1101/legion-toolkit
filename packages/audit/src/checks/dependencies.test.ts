import { findForbidden } from './dependencies.js';

describe('findForbidden', () => {
  it('flags the section 9 libraries and says what to use instead', () => {
    const found = findForbidden(
      ['redux', 'react-redux', '@reduxjs/toolkit', 'mobx', 'styled-components'],
      {},
    );
    expect(found.map((entry) => entry.name)).toEqual([
      'redux',
      'react-redux',
      '@reduxjs/toolkit',
      'mobx',
      'styled-components',
    ]);
    expect(found[0]?.instead).toContain('Zustand');
  });

  it('leaves the sanctioned choices alone', () => {
    expect(
      findForbidden(
        ['zustand', 'clsx', 'tailwind-merge', 'lucide-react', 'zod', 'next'],
        {},
      ),
    ).toEqual([]);
  });

  it('does not match a package that merely contains a forbidden name', () => {
    expect(
      findForbidden(['redux-devtools-themes', 'my-mobx-helpers'], {}),
    ).toEqual([]);
  });

  it('carries the declared version through', () => {
    const found = findForbidden(['moment'], { moment: '^2.30.0' });
    expect(found[0]?.version).toBe('^2.30.0');
  });
});
