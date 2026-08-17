import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_event_results",
  title: "Get event results",
  description:
    "Get published results for an event, optionally filtered by rider name. Returns position, category and finishing time.",
  inputSchema: {
    event_id: z.string().min(1).describe("The event id returned by list_events."),
    name: z.string().trim().optional().describe("Filter to riders whose name contains this text."),
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of rows."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_id, name, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("event_results")
      .select("position, full_name, category, batch, bib_number, time_text, gap_text, status")
      .eq("event_id", event_id)
      .order("position", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (name) q = q.ilike("full_name", `%${name}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data?.length) {
      return { content: [{ type: "text", text: "No published results found for that event." }], structuredContent: { results: [] } };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { results: data },
    };
  },
});
