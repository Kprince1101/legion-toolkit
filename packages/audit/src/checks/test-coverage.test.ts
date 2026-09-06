import { classify, coveredNames } from './test-coverage.js';

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

describe('coveredNames', () => {
  it('reads every component a batch test file imports', () => {
    const source = [
      "import { MenuHeader } from '../MenuHeader';",
      "import { MenuNav } from '../MenuNav';",
      "import { render } from '@testing-library/react';",
      "describe('presentational components', () => {});",
    ].join('\n');
    expect(coveredNames(source)).toEqual(
      expect.arrayContaining(['MenuHeader', 'MenuNav']),
    );
  });

  it('ignores bare package imports', () => {
    expect(coveredNames("import React from 'react';")).toEqual([]);
  });

  it('reads the subject out of a describe title', () => {
    expect(
      coveredNames("describe('useMenuPanel returns sections', () => {})"),
    ).toEqual(['useMenuPanel']);
  });
});

describe('classify with a batch test file', () => {
  const files = [
    'components/MenuHeader.tsx',
    'components/MenuNav.tsx',
    'components/MenuList.tsx',
    'components/__tests__/presentational.test.tsx',
  ];

  it('docks every component when it only matches base names', () => {
    expect(classify(files).missing).toHaveLength(3);
  });

  it('counts all of them once it reads what the batch file covers', () => {
    const covered = {
      'components/__tests__/presentational.test.tsx': [
        'MenuHeader',
        'MenuNav',
        'MenuList',
      ],
    };
    const result = classify(files, covered);
    expect(result.missing).toEqual([]);
    expect(result.source).toBe('references');
  });
});

describe('classify with a real coverage report', () => {
  it('believes the coverage report over any filename heuristic', () => {
    const files = ['components/Untested.tsx', 'components/Covered.tsx'];
    const result = classify(
      files,
      {},
      {
        available: true,
        files: {
          'components/Covered.tsx': true,
          'components/Untested.tsx': false,
        },
        totalPct: 91.4,
      },
    );
    expect(result.missing).toEqual([
      { file: 'components/Untested.tsx', kind: 'component' },
    ]);
    expect(result.source).toBe('coverage-report');
    expect(result.totalPct).toBe(91.4);
  });
});
