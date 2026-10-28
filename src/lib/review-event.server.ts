// Server guard for private app-review events read with the service-role client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/** IDs of every review event, for excluding them from service-role lists. */
export async function reviewEventIds(admin: AnyClient): Promise<string[]> {
  const { data } = await admin.from("events").select("id").eq("is_review_event", true);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/** Throws "Event not found" unless the event is normal or the caller is an admin/entrant of the review event. */
export async function assertEventVisible(admin: AnyClient, eventId: string, userId?: string | null) {
  const { data: ev } = await admin.from("events").select("is_review_event").eq("id", eventId).maybeSingle();
  if (!ev?.is_review_event) return;
  if (userId) {
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").limit(1);
    if (role?.length) return;
    const { data: entry } = await admin.from("entries").select("id").eq("event_id", eventId).eq("user_id", userId).limit(1);
    if (entry?.length) return;
    const { data: ee } = await admin
      .from("event_entrants")
      .select("id, entrants!inner(user_id)")
      .eq("event_id", eventId)
      .eq("entrants.user_id", userId)
      .limit(1);
    if (ee?.length) return;
  }
  throw new Error("Event not found");
}

/** Resolves the optional signed-in caller of a public server function and applies the guard. */
export async function assertEventVisibleToCaller(admin: AnyClient, eventId: string) {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const { resolveOptionalUserId } = await import("@/lib/app-bot.server");
  const userId = await resolveOptionalUserId(getRequestHeader("authorization") ?? null);
  await assertEventVisible(admin, eventId, userId);
}
