import rule from './no-admin-client-in-browser.js';
import { runRule } from '../test-utils.js';

const ADMIN_IMPORT =
  "import { createAdminClient } from '@/lib/supabase/admin';\nexport const load = () => createAdminClient();";

runRule('no-admin-client-in-browser', rule, {
  valid: [
    { code: ADMIN_IMPORT, filename: 'app/api/inbox/route.ts' },
    { code: ADMIN_IMPORT, filename: 'lib/inbox.ts' },
    { code: ADMIN_IMPORT, filename: 'app/dashboard/page.tsx' },
    {
      code: "import { createClient } from '@/lib/supabase/client';\nexport const A = () => null;",
      filename: 'components/A.tsx',
    },
    {
      code: "'use client';\nimport { createClient } from '@/lib/supabase/client';\nexport const A = () => null;",
      filename: 'app/x/XClient.tsx',
    },
  ],
  invalid: [
    {
      code: ADMIN_IMPORT,
      filename: 'components/Board.tsx',
      errors: [
        {
          messageId: 'adminInBrowser',
          data: { source: '@/lib/supabase/admin' },
        },
      ],
    },
    {
      code: ADMIN_IMPORT,
      filename: 'hooks/useBoard.ts',
      errors: [{ messageId: 'adminInBrowser' }],
    },
    {
      code: ADMIN_IMPORT,
      filename: 'app/dashboard/DashboardClient.tsx',
      errors: [{ messageId: 'adminInBrowser' }],
    },
    {
      code: `'use client';\n${ADMIN_IMPORT}`,
      filename: 'app/dashboard/page.tsx',
      errors: [{ messageId: 'adminInBrowser' }],
    },
    {
      code: "import { db } from '../db/service-role';\nexport const A = () => null;",
      filename: 'components/A.tsx',
      options: [{ adminModules: ['service-role'] }],
      errors: [
        { messageId: 'adminInBrowser', data: { source: '../db/service-role' } },
      ],
    },
  ],
});
