interface AdminClient {
  from: (table: string) => { select: (columns: string) => Promise<unknown> };
}

export const supabaseAdmin = {} as AdminClient;
