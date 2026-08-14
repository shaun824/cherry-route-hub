// Applies a rooming list (from a Google Sheet) to one venue: replaces the
// venue's allocations, links riders by email and drops each person on the
// matching drawn village-map area.
import { labelsMatch, type ParsedRoomingRow } from "@/lib/rooming-import";
import { readSheetRooming } from "@/lib/rooming-sheet.server";

type AnyClient = {
  from: (table: string) => any;
};

type Zone = { id: string; name?: string | null };

export async function placeRows(
  client: AnyClient,
  eventId: string,
  venueId: string,
  rows: ParsedRoomingRow[],
) {
  const emails = rows.map((r) => r.email.toLowerCase()).filter(Boolean);
  const entrantByEmail = new Map<string, string>();
  if (emails.length) {
    const { data } = await client.from("entrants").select("id, email").in("email", emails);
    for (const e of (data ?? []) as { id: string; email: string | null }[]) {
      if (e.email) entrantByEmail.set(e.email.toLowerCase(), e.id);
    }
  }

  const { data: village } = await client
    .from("event_village_maps")
    .select("zones")
    .eq("event_id", eventId)
    .maybeSingle();
  const zones: Zone[] = Array.isArray(village?.zones) ? (village!.zones as Zone[]) : [];

  function zoneFor(row: ParsedRoomingRow): string | null {
    const hit =
      zones.find((z) => labelsMatch(z.name, row.area)) ??
      zones.find((z) => labelsMatch(z.name, row.tent_number));
    return hit?.id ?? null;
  }

  await client.from("event_rooming").delete().eq("event_id", eventId).eq("venue_id", venueId);

  const payload = rows.map((r) => ({
    event_id: eventId,
    venue_id: venueId,
    entrant_id: r.email ? entrantByEmail.get(r.email.toLowerCase()) ?? null : null,
    full_name: r.full_name || r.email || "Unnamed",
    email: r.email || null,
    tent_number: r.tent_number || null,
    room_type: r.room_type || null,
    notes: r.notes || null,
    location_hint: r.location_hint || null,
    village_zone_id: zoneFor(r),
  }));

  if (payload.length) {
    const { error } = await client.from("event_rooming").insert(payload);
    if (error) throw new Error(error.message);
  }

  return {
    imported: payload.length,
    matched: payload.filter((p) => p.entrant_id).length,
    placed: payload.filter((p) => p.village_zone_id).length,
  };
}

/** Pulls one venue's linked Google Sheet and rewrites its allocations. */
export async function syncVenueSheet(client: AnyClient, venueId: string) {
  const { data: venue, error } = await client
    .from("event_venues")
    .select("id, event_id, name, rooming_sheet_url, rooming_sheet_range")
    .eq("id", venueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!venue?.rooming_sheet_url) throw new Error("This venue has no Google Sheet linked.");

  try {
    const { rows } = await readSheetRooming(venue.rooming_sheet_url, venue.rooming_sheet_range);
    const result = await placeRows(client, venue.event_id, venue.id, rows);
    await client
      .from("event_venues")
      .update({
        rooming_sheet_synced_at: new Date().toISOString(),
        rooming_sheet_error: null,
        rooming_sheet_rows: result.imported,
      })
      .eq("id", venue.id);
    return { ok: true as const, venue: venue.name as string, ...result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    await client
      .from("event_venues")
      .update({ rooming_sheet_error: message, rooming_sheet_synced_at: new Date().toISOString() })
      .eq("id", venue.id);
    return { ok: false as const, venue: venue.name as string, error: message };
  }
}
