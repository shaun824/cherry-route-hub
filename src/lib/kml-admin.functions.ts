import { createServerFn } from "@tanstack/react-start";

// Temporary maintenance helper: mint long-lived signed URLs for stored KML files.
export const signKmlPaths = createServerFn({ method: "POST" })
  .inputValidator((input: { paths: string[] }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Record<string, string> = {};
    for (const p of data.paths) {
      const { data: signed, error } = await supabaseAdmin.storage
        .from("event-kmls")
        .createSignedUrl(p, 60 * 60 * 24 * 365 * 10);
      if (error) throw error;
      out[p] = signed.signedUrl;
    }
    return out;
  });
