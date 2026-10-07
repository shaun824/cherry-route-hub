/**
 * Which apparel sizes an event collects. Driven by the per-event
 * `collects_tshirt_size` / `collects_jacket_size` flags (set by staff, or
 * switched on automatically when Entry Ninja syncs a size for the event).
 */
export type ApparelFlags = { tshirt: boolean; jacket: boolean };

export function eventApparel(
  event: { collects_tshirt_size?: boolean | null; collects_jacket_size?: boolean | null } | null | undefined,
): ApparelFlags {
  return {
    tshirt: Boolean(event?.collects_tshirt_size),
    jacket: Boolean(event?.collects_jacket_size),
  };
}

export function hasSize(v: string | null | undefined): boolean {
  return Boolean(v && v.trim());
}

/** Which sizes the rider still needs to supply, given the event flags. */
export function missingSizes(
  flags: ApparelFlags,
  row: { tshirt_size?: string | null; jacket_size?: string | null } | null | undefined,
): ApparelFlags {
  return {
    tshirt: flags.tshirt && !hasSize(row?.tshirt_size),
    jacket: flags.jacket && !hasSize(row?.jacket_size),
  };
}

export function missingSizeMessage(m: ApparelFlags): string | null {
  if (m.tshirt && m.jacket)
    return "We don't have your T-shirt or jacket size yet. Add them on Entry Ninja so we can pack the right ones for you.";
  if (m.tshirt) return "We don't have your T-shirt size yet. Add it on Entry Ninja so we can pack the right one for you.";
  if (m.jacket) return "We don't have your jacket size yet. Add it on Entry Ninja so we can pack the right one for you.";
  return null;
}

/** Server-side: switch the event's flags on when a sync wrote a size. */
export async function markEventCollectsSizes(
  client: { from: (t: string) => any },
  eventId: string,
  seen: ApparelFlags,
) {
  const patch: Record<string, boolean> = {};
  if (seen.tshirt) patch.collects_tshirt_size = true;
  if (seen.jacket) patch.collects_jacket_size = true;
  if (!Object.keys(patch).length) return;
  await client.from("events").update(patch).eq("id", eventId);
}
