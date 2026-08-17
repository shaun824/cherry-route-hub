import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_news",
  title: "List news posts",
  description: "List recent Red Cherry Events news feed posts, newest first.",
  inputSchema: {
    event_id: z.string().optional().describe("Only posts for this event id."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of posts."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("feed_posts")
      .select("id, title, body, author, post_type, pinned, posted_at, source_url, event_id")
      .order("posted_at", { ascending: false })
      .limit(limit);
    if (event_id) q = q.eq("event_id", event_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { posts: data ?? [] },
    };
  },
});
