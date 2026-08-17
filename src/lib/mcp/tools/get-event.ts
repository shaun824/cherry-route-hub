import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_event",
  title: "Get event details",
  description:
    "Get full details for one event: schedule, venue, route info, packing list, FAQs and parking notes. Look the id up with list_events.",
  inputSchema: {
    event_id: z.string().min(1).describe("The event id returned by list_events."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);

    const { data: event, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!event) return { content: [{ type: "text", text: "Event not found" }], isError: true };

    const { data: info } = await supabase
      .from("event_info_blocks")
      .select(
        "venue_address, venue_lat, venue_lng, parking_notes, route_description, distance_km, elevation_m, packing_list, faqs, emergency_contacts",
      )
      .eq("event_id", event_id)
      .maybeSingle();

    const payload = { event, info: info ?? null };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
