import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Event reads use caller-scoped RLS before any privileged work. */
export async function requireEventParticipant(client: SupabaseClient<Database>, userId: string, eventId: string) {
  const { data: event, error } = await client.from("events").select("id").eq("id", eventId).maybeSingle();
  if (error || !event) throw new Error("Event not found");
  const { data: roles } = await client.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "crew"]);
  if (roles?.length) return;
  const { data: entries } = await client.from("event_entrants").select("id, entrants!inner(user_id)").eq("event_id", eventId).eq("entrants.user_id", userId).limit(1);
  if (!entries?.length) throw new Error("Forbidden");
}