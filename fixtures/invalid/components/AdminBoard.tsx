import { createAdminClient } from '../lib/supabase/admin';

export const AdminBoard = () => {
  const client = createAdminClient();
  return <div>{String(client)}</div>;
};
