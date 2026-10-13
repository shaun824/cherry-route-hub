import { createFileRoute } from "@tanstack/react-router";

// Strava OAuth callback. The signed `state` proves which signed-in user started the flow.
export const Route = createFileRoute("/api/public/strava/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { verifyState, exchangeCode } = await import("@/lib/strava.server");
        const st = await verifyState(url.searchParams.get("state") ?? "");
        const back = (q: string) =>
          Response.redirect(`${url.origin}${st?.returnTo ?? "/profile"}${(st?.returnTo ?? "").includes("?") ? "&" : "?"}strava=${q}`, 302);
        if (!st) return back("invalid");
        const code = url.searchParams.get("code");
        if (!code || url.searchParams.get("error")) return back("denied");
        try {
          const t = await exchangeCode(code);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("strava_connections").upsert({
            user_id: st.userId,
            athlete_id: t.athlete?.id ?? 0,
            athlete_name: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(" ") || null,
            access_token: t.access_token,
            refresh_token: t.refresh_token,
            expires_at: new Date(t.expires_at * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          });
          if (error) throw new Error(error.message);
          return back("connected");
        } catch (e) {
          console.error("Strava callback failed", e);
          return back("error");
        }
      },
    },
  },
});
