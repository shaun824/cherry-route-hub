import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ eventId: z.string().uuid() });

export type SpectatorEntrant = {
  id: string;
  full_name: string;
  category: string | null;
  batch: string | null;
  bib_number: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export const getSpectatorRoster = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<SpectatorEntrant[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only expose the roster for events the admin has marked as spectator-open.
    const { data: ev, error: evErr } = await supabaseAdmin
      .from("events")
      .select("id, spectator_mode")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!ev || !ev.spectator_mode) return [];

    const { data: rows, error } = await supabaseAdmin
      .from("event_entrants")
      .select(
        "id, category, batch, bib_number, started_at, finished_at, entrants:entrants!inner(full_name)",
      )
      .eq("event_id", data.eventId);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => ({
      id: String(r.id),
      full_name: String(r.entrants?.full_name ?? ""),
      category: (r.category as string | null) ?? null,
      batch: (r.batch as string | null) ?? null,
      bib_number: (r.bib_number as string | null) ?? null,
      started_at: (r.started_at as string | null) ?? null,
      finished_at: (r.finished_at as string | null) ?? null,
    }));
  });
