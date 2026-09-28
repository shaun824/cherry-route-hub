import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Opened as a popup from the website chat. Browsers keep a website-embedded
// chat's storage separate from the app, so this first-party window hands the
// rider's app session back to the chat that opened it (same origin only).
export const Route = createFileRoute("/embed/connect")({
  head: () => ({
    meta: [
      { title: "Connecting your Rider Hub account" },
      { name: "description", content: "Sign the Red Cherry website chat in with your Rider Hub account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Connecting your Rider Hub account" },
      { property: "og:description", content: "Sign the Red Cherry website chat in with your Rider Hub account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Connect,
});

function Connect() {
  const [msg, setMsg] = useState("Connecting your account…");
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      if (!s) {
        window.location.replace(`/auth?next=${encodeURIComponent("/embed/connect")}`);
        return;
      }
      if (!window.opener) {
        setMsg("You're signed in. Close this window and return to the chat.");
        return;
      }
      window.opener.postMessage(
        { type: "rce-embed-session", access_token: s.access_token, refresh_token: s.refresh_token },
        window.location.origin,
      );
      setMsg("Connected — you can close this window.");
      setTimeout(() => window.close(), 400);
    })();
  }, []);
  return <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center text-sm">{msg}</div>;
}
