// Background job callers must send the private job key (x-cron-key header).
// The publishable key is public, so it is never enough on its own.
export async function verifyCronRequest(request: Request): Promise<Response | null> {
  const key = request.headers.get("x-cron-key") ?? "";
  if (key) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("verify_cron_key" as never, { _key: key } as never);
    if (data === true) return null;
  }
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
