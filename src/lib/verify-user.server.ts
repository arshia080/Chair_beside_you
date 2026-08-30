import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Mirrors the getClaims check in integrations/supabase/auth-middleware.ts (generated,
// can't be edited) so route handlers that can't use createServerFn middleware still
// verify tokens the same way as server functions do.
export async function verifySupabaseUser(token: string) {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub as string };
}
