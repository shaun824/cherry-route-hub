// Builds the "this specific rider" block of the event bot's context: their
// profile, their Entry Ninja entry for the event (category, bib, balance) and
// their accommodation allocation (tent number + where it sits on the village
// map). Everything is resolved from the signed-in user's own records only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { priceEntry } from "./entry-pricing";
import { entryNinjaRegistrationUrl } from "@/lib/entry-ninja-link";

type AnyClient = SupabaseClient<any, any, any>;

function money(cents: number | null | undefined) {
  if (cents == null) return null;
  return `R${(cents / 100).toFixed(2)}`;
}

export async function buildRiderContext(
  admin: AnyClient,
  userId: string,
  eventId: string,
): Promise<string> {
  const lines: string[] = [];

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "full_name, email, phone, tshirt_size, jacket_size, entry_ninja_id, emergency_contact_name, emergency_contact_phone",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profile) {
    lines.push("Rider profile:");
    if (profile.full_name) lines.push(`- Name: ${profile.full_name}`);
    if (profile.email) lines.push(`- Email: ${profile.email}`);
    if (profile.phone) lines.push(`- Phone: ${profile.phone}`);
    if (profile.tshirt_size) lines.push(`- T-shirt size: ${profile.tshirt_size}`);
    if (profile.jacket_size) lines.push(`- Jacket size: ${profile.jacket_size}`);
    if (profile.entry_ninja_id) lines.push(`- Entry Ninja ID: ${profile.entry_ninja_id}`);
    if (profile.emergency_contact_name)
      lines.push(
        `- Emergency contact: ${profile.emergency_contact_name}${
          profile.emergency_contact_phone ? ` (${profile.emergency_contact_phone})` : ""
        }`,
      );
  }

  // Every entrant record that belongs to this login (ID-number claims included),
  // plus any unclaimed entrant row that carries the same email address.
  const { data: ownedRows } = await admin
    .from("entrants")
    .select("id, full_name, email")
    .eq("user_id", userId);
  let entrantRows = ownedRows ?? [];
  if (profile?.email) {
    const { data: byEmail } = await admin
      .from("entrants")
      .select("id, full_name, email")
      .ilike("email", profile.email);
    for (const e of byEmail ?? []) {
      if (!entrantRows.some((o: any) => o.id === e.id)) entrantRows = [...entrantRows, e];
    }
  }
  const entrantIds = entrantRows.map((e: any) => e.id as string);
  const emails = new Set<string>();
  if (profile?.email) emails.add(String(profile.email).toLowerCase());
  for (const e of entrantRows) if (e.email) emails.add(String(e.email).toLowerCase());


  // Entry Ninja entry for this event.
  let entryIds: string[] = [];
  if (entrantIds.length) {
    const { data: entries } = await admin
      .from("event_entrants")
      .select(
        "id, category, batch, bib_number, registration_ref, external_id, team_name, paid, amount_due_cents, amount_paid_cents, tshirt_size, jacket_size, extras, notes",
      )
      .eq("event_id", eventId)
      .in("entrant_id", entrantIds);
    entryIds = (entries ?? []).map((e: any) => e.id as string);
    for (const e of entries ?? []) {
      lines.push("\nRider's entry for this event (from Entry Ninja):");
      if (e.registration_ref) {
        lines.push(`- Registration ref: ${e.registration_ref}`);
        const regUrl = entryNinjaRegistrationUrl(e.registration_ref);
        if (regUrl)
          lines.push(
            `- To add merchandise or extras, or change sizes, the rider opens their own Entry Ninja registration: ${regUrl} (always give this exact link when they ask how to add merch, extras or upgrades)`,
          );
      }
      if (e.category) lines.push(`- Category: ${e.category}`);
      if (e.batch) lines.push(`- Batch / start group: ${e.batch}`);
      if (e.bib_number) lines.push(`- Race number: ${e.bib_number}`);
      if (e.tshirt_size) lines.push(`- T-shirt size on entry: ${e.tshirt_size}`);
      if (e.jacket_size) lines.push(`- Jacket size on entry: ${e.jacket_size}`);
      if (Array.isArray(e.extras) && e.extras.length)
        lines.push(`- Extras ordered: ${e.extras.map((x: any) => x.label ?? x.name ?? x).join(", ")}`);
      let due = e.amount_due_cents ?? 0;
      const paidAmt = e.amount_paid_cents ?? 0;
      // No imported amount? Price the entry off the event price book.
      if (!due) {
        const { data: priceRows } = await admin
          .from("event_price_book")
          .select("id, event_id, kind, label, price_cents, notes")
          .eq("event_id", eventId);
        const priced = priceEntry((priceRows ?? []) as any, {
          category: e.category ?? null,
          extras: Array.isArray(e.extras) ? (e.extras as any) : [],
        });
        if (priced.totalCents) due = priced.totalCents;
      }
      lines.push(`- Payment status: ${e.paid ? "paid in full" : "outstanding balance"}`);
      if (due) lines.push(`- Entry total: ${money(due)}`);
      if (paidAmt) lines.push(`- Paid so far: ${money(paidAmt)}`);
      if (!e.paid && due > paidAmt) lines.push(`- Amount still owing: ${money(due - paidAmt)}`);
      if (e.notes) lines.push(`- Entry notes: ${e.notes}`);
      if (e.team_name) {
        lines.push(`- Team: ${e.team_name}`);
        const { data: mates } = await admin
          .from("event_entrants")
          .select("category, bib_number, entrant:entrants(full_name)")
          .eq("event_id", eventId)
          .ilike("team_name", e.team_name);
        const names = (mates ?? [])
          .map((m: any) => m.entrant?.full_name)
          .filter(Boolean);
        if (names.length > 1)
          lines.push(`- Team mates on this entry: ${names.join(", ")}`);
      }
    }
  }

  // Accommodation / tent allocation.
  const { data: rooming } = await admin
    .from("event_rooming")
    .select(
      "id, full_name, email, tent_number, room_type, notes, location_hint, entrant_id, event_entrant_id, village_zone_id, village_tent_id, night_index, venue:event_venues(name, address, notes, night_start, nights, check_in, check_out)",
    )

    .eq("event_id", eventId);

  const names = new Set<string>();
  const addName = (v?: string | null) => {
    const n = String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (n.length > 3) names.add(n);
  };
  addName(profile?.full_name);
  for (const e of entrantRows ?? []) addName(e.full_name);

  const isMine = (r: any) =>
    (r.event_entrant_id && entryIds.includes(r.event_entrant_id)) ||
    (r.entrant_id && entrantIds.includes(r.entrant_id)) ||
    (r.email && emails.has(String(r.email).toLowerCase())) ||
    (r.full_name && names.has(String(r.full_name).trim().toLowerCase().replace(/\s+/g, " ")));

  const mineAll = (rooming ?? []).filter(isMine);
  const mine = mineAll[0] ?? null;

  // Moving events: the rider sleeps at a different venue each night.
  if (mineAll.length > 1) {
    lines.push(
      "\nThis event moves between venues, so the rider has a different bed each night. Their full stay:",
    );
    for (const r of mineAll) {
      const v: any = Array.isArray(r.venue) ? r.venue[0] : r.venue;
      const nightStart = r.night_index ?? v?.night_start ?? null;
      const nightCount = r.night_index ? 1 : (v?.nights ?? null);
      const when = nightStart
        ? `Night ${nightStart}${nightCount && nightCount > 1 ? `–${nightStart + nightCount - 1}` : ""}`
        : "Night not specified";
      const bits = [
        v?.name ? `${v.name}${v.address ? ` (${v.address})` : ""}` : "venue TBC",
        r.tent_number ? `tent/room ${r.tent_number}` : null,
        r.room_type || null,
        v?.check_in ? `check-in ${v.check_in}` : null,
        v?.check_out ? `check-out ${v.check_out}` : null,
      ].filter(Boolean);
      lines.push(`- ${when}: ${bits.join(" · ")}`);
    }
    lines.push(
      "Tell them they can see this night-by-night in the app under the Accommodation tab on the event page.",
    );
  }




  if (mine) {
    lines.push("\nRider's accommodation for this event (from the uploaded rooming list):");
    if (mine.tent_number) lines.push(`- Tent / room number: ${mine.tent_number}`);
    if (mine.room_type) lines.push(`- Room type: ${mine.room_type}`);
    const venue = Array.isArray(mine.venue) ? mine.venue[0] : mine.venue;
    if (venue?.name) lines.push(`- Venue: ${venue.name}${venue.address ? ` — ${venue.address}` : ""}`);
    if (mine.location_hint) lines.push(`- Where to find it: ${mine.location_hint}`);
    if (mine.notes) lines.push(`- Notes: ${mine.notes}`);

    if (mine.village_tent_id) {
      const { data: pin } = await admin
        .from("event_village_tents")
        .select("label, notes")
        .eq("id", mine.village_tent_id)
        .maybeSingle();
      if (pin?.label)
        lines.push(
          `- Pinned on the village map as "${pin.label}" — the rider can tap "Show me on the village map" in the app to navigate to it.`,
        );
    }
    if (mine.village_zone_id) {
      const { data: vmap } = await admin
        .from("event_village_maps")
        .select("zones")
        .eq("event_id", eventId)
        .maybeSingle();
      const zone = (Array.isArray(vmap?.zones) ? vmap!.zones : []).find(
        (z: any) => z.id === mine.village_zone_id,
      );
      if (zone?.name) lines.push(`- Village map area: ${zone.name}`);
    }
  } else if ((rooming ?? []).length) {
    lines.push(
      "\nAccommodation: a rooming list exists for this event but no allocation is linked to this rider yet — tell them to check with the Red Cherry team.",
    );
  }

  // Other events this rider is entered into, for cross-event questions.
  if (entrantIds.length) {
    const { data: otherEntries } = await admin
      .from("event_entrants")
      .select("event_id, category, events(name, event_date)")
      .in("entrant_id", entrantIds)
      .neq("event_id", eventId)
      .limit(20);
    const others = (otherEntries ?? [])
      .map((e: any) => {
        const ev = Array.isArray(e.events) ? e.events[0] : e.events;
        return ev?.name ? `${ev.name}${e.category ? ` (${e.category})` : ""}` : null;
      })
      .filter(Boolean);
    if (others.length) lines.push(`\nOther events this rider is entered in: ${others.join(", ")}`);
  }

  return lines.join("\n");
}
