import { supabaseAdmin } from './supabase/admin';

export const readFeed = async () => supabaseAdmin.from('posts').select('*');
