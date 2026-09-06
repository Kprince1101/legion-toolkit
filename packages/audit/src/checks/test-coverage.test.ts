import { classify } from './test-coverage.js';

describe('classify', () => {
  it('pairs components and hooks with test files by base name', () => {
    const files = [
      'components/MenuHeader.tsx',
      'components/__tests__/MenuHeader.test.tsx',
      'components/MenuNav.tsx',
      'hooks/useMenuPanel.ts',
      'hooks/useMenuPanel.test.ts',
      'hooks/useScrollSpy.ts',
      'app/dashboard/page.tsx',
      'app/dashboard/DashboardClient.tsx',
      'app/dashboard/layout.tsx',
      'lib/format.ts',
      'components/icons.tsx',
      'jest.config.ts',
    ];
    const result = classify(files);
    expect(result.components).toBe(3);
    expect(result.hooks).toBe(2);
    expect(result.missing).toEqual([
      { file: 'components/MenuNav.tsx', kind: 'component' },
      { file: 'hooks/useScrollSpy.ts', kind: 'hook' },
      { file: 'app/dashboard/DashboardClient.tsx', kind: 'component' },
    ]);
  });
});
