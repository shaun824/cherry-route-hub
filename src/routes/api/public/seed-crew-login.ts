// TEMPORARY one-off seeding endpoint — deleted right after use.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/seed-crew-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { username: string; password: string; token: string };
        if (body.token !== "rce-seed-once") return new Response("no", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { crewEmailForUsername, normaliseCrewUsername } = await import("@/lib/crew-username");
        const username = normaliseCrewUsername(body.username);
        const email = crewEmailForUsername(username);
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: body.password,
          email_confirm: true,
          user_metadata: { full_name: "Red Cherry Crew", crew_username: username },
        });
        let userId = data?.user?.id ?? null;
        if (error && !userId) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const found = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
          if (!found) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
          userId = found.id;
          await supabaseAdmin.auth.admin.updateUserById(userId, { password: body.password });
        }
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId!, role: "crew" }, { onConflict: "user_id,role", ignoreDuplicates: true });
        return new Response(JSON.stringify({ ok: true, username, user_id: userId }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
