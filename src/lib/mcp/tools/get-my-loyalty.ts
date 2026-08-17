import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_loyalty",
  title: "Get my Cherry Miles",
  description: "Get the signed-in rider's Cherry Miles loyalty balance and recent ledger entries.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);

    const { data: entrants, error: entrantErr } = await supabase
      .from("entrants")
      .select("id")
      .eq("user_id", ctx.getUserId());
    if (entrantErr) return { content: [{ type: "text", text: entrantErr.message }], isError: true };
    const ids = (entrants ?? []).map((e) => e.id);
    if (ids.length === 0) {
      return {
        content: [{ type: "text", text: "No rider profile linked to your account yet." }],
        structuredContent: { balance: 0, ledger: [] },
      };
    }

    const { data, error } = await supabase
      .from("loyalty_ledger")
      .select("points, kind, reason, created_at")
      .in("entrant_id", ids)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const balance = (data ?? []).reduce((sum, row) => sum + (row.points ?? 0), 0);
    const payload = { balance, ledger: data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
