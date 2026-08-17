import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_entries",
  title: "List my entries",
  description:
    "List the signed-in rider's event entries, including category, batch, bib number and payment balance.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of entries."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);

    const { data: entrants, error: entrantErr } = await supabase
      .from("entrants")
      .select("id, full_name")
      .eq("user_id", ctx.getUserId());
    if (entrantErr) return { content: [{ type: "text", text: entrantErr.message }], isError: true };

    const ids = (entrants ?? []).map((e) => e.id);
    if (ids.length === 0) {
      return {
        content: [{ type: "text", text: "No entries linked to your account yet." }],
        structuredContent: { entries: [] },
      };
    }

    const { data, error } = await supabase
      .from("event_entrants")
      .select(
        "id, event_id, category, batch, bib_number, paid, amount_due_cents, amount_paid_cents, tshirt_size, jacket_size, events(name, event_date, location)",
      )
      .in("entrant_id", ids)
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { entries: data ?? [] },
    };
  },
});
