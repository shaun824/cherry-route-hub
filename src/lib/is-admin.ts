// Admin check that reads the user_roles table under RLS ("read own roles"),
// instead of calling the SECURITY DEFINER is_admin() RPC from the client.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function checkIsAdmin(client: SupabaseClient<any, any, any>): Promise<boolean> {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("role", "admin")
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}
