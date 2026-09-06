import rule, { isAppRouteFile } from './no-use-client-in-page.js';
import { runRule } from '../test-utils.js';

const CLIENT_PAGE =
  "'use client';\nconst Page = () => null;\nexport default Page;";

runRule('no-use-client-in-page', rule, {
  valid: [
    {
      code: 'const Page = async () => null;\nexport default Page;',
      filename: 'app/dashboard/page.tsx',
    },
    { code: CLIENT_PAGE, filename: 'app/dashboard/DashboardClient.tsx' },
    { code: CLIENT_PAGE, filename: 'components/page.tsx' },
    { code: CLIENT_PAGE, filename: 'src/pages/page.tsx' },
    { code: "import x from 'y';\n'use client';", filename: 'app/page.tsx' },
  ],
  invalid: [
    {
      code: CLIENT_PAGE,
      filename: 'app/dashboard/page.tsx',
      errors: [{ messageId: 'useClientInPage' }],
    },
    {
      code: CLIENT_PAGE,
      filename: '/repo/app/(auth)/login/layout.tsx',
      errors: [{ messageId: 'useClientInPage' }],
    },
    {
      code: CLIENT_PAGE,
      filename: 'C:\\repo\\src\\app\\page.tsx',
      errors: [{ messageId: 'useClientInPage' }],
    },
    {
      code: '"use client";\nexport default () => null;',
      filename: 'app/page.jsx',
      errors: [{ messageId: 'useClientInPage' }],
    },
  ],
});

describe('isAppRouteFile', () => {
  it('matches page and layout files under an app segment', () => {
    expect(isAppRouteFile('app/page.tsx')).toBe(true);
    expect(isAppRouteFile('src/app/(group)/x/layout.ts')).toBe(true);
    expect(isAppRouteFile('app/x/loading.tsx')).toBe(false);
    expect(isAppRouteFile('apps/web/page.tsx')).toBe(false);
    expect(isAppRouteFile('app/x/PageClient.tsx')).toBe(false);
  });
});
