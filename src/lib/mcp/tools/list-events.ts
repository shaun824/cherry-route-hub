import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_events",
  title: "List events",
  description:
    "List Red Cherry Events rides and races with dates, locations and discipline. Defaults to upcoming events.",
  inputSchema: {
    scope: z.enum(["upcoming", "past", "all"]).default("upcoming").describe("Which events to return."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of events."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ scope, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const today = new Date().toISOString().slice(0, 10);
    let q = supabase
      .from("events")
      .select("id, name, event_date, location, discipline, status, distance_km, website_url, entry_ninja_url")
      .limit(limit);
    if (scope === "upcoming") q = q.gte("event_date", today).order("event_date", { ascending: true });
    else if (scope === "past") q = q.lt("event_date", today).order("event_date", { ascending: false });
    else q = q.order("event_date", { ascending: false });

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { events: data ?? [] },
    };
  },
});
