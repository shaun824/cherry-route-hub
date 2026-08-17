// WhatsApp Cloud API webhook: verification handshake (GET) + inbound messages (POST).
// Inbound messages land in admin_qa_threads / admin_qa_messages so the admin
// inbox shows WhatsApp conversations next to in-app ones.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      // Meta verification handshake.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const expected = process.env["WHATSAPP_VERIFY_TOKEN"];
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const { verifyMetaSignature } = await import("@/lib/whatsapp.server");
        const ok = await verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"));
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          for (const entry of payload?.entry ?? []) {
            for (const change of entry?.changes ?? []) {
              const value = change?.value ?? {};

              // Delivery / read receipts for broadcasts we sent.
              for (const st of value.statuses ?? []) {
                const id = String(st?.id ?? "");
                const status = String(st?.status ?? "");
                if (!id || !status) continue;
                await supabaseAdmin
                  .from("notification_deliveries")
                  .update({
                    wa_status: status,
                    wa_status_at: new Date().toISOString(),
                    ...(status === "failed"
                      ? { status: "failed", error: String(st?.errors?.[0]?.title ?? "failed").slice(0, 300) }
                      : {}),
                  })
                  .eq("wa_message_id", id);
              }

              const contacts: any[] = value.contacts ?? [];
              for (const msg of value.messages ?? []) {
                if (msg?.type !== "text") continue;
                const from: string = String(msg.from ?? "").replace(/[^\d]/g, "");
                const body: string = String(msg.text?.body ?? "").slice(0, 4000);
                if (!from || !body) continue;
                const waName =
                  contacts.find((c) => String(c?.wa_id ?? "").replace(/[^\d]/g, "") === from)
                    ?.profile?.name ?? null;

                // Consent keywords take priority over normal ingestion.
                const keyword = body.trim().toUpperCase();
                if (["STOP", "UNSUBSCRIBE", "OPTOUT", "OPT OUT"].includes(keyword)) {
                  await supabaseAdmin
                    .from("whatsapp_opt_outs")
                    .upsert({ phone: from, reason: "rider sent STOP" });
                  continue;
                }
                if (["START", "SUBSCRIBE", "UNSTOP"].includes(keyword)) {
                  await supabaseAdmin.from("whatsapp_opt_outs").delete().eq("phone", from);
                  continue;
                }

                await ingestInbound(supabaseAdmin, from, waName, body);
              }
            }
          }
        } catch (err) {
          console.error("[whatsapp] inbound handling failed", err);
          // Always 200 so Meta does not retry-storm on a storage hiccup.
        }


        return new Response("ok", { status: 200 });
      },
    },
  },
});

async function ingestInbound(
  admin: any,
  phone: string,
  waName: string | null,
  body: string,
): Promise<void> {
  // Existing WhatsApp thread for this number?
  const { data: existing } = await admin
    .from("admin_qa_threads")
    .select("id")
    .eq("channel", "whatsapp")
    .eq("wa_phone", phone)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  let threadId: string | null = existing?.id ?? null;

  if (!threadId) {
    // Match the number to a rider profile, and pick their next upcoming event.
    const tail = phone.slice(-9);
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("phone", `%${tail}`)
      .limit(1)
      .maybeSingle();

    const { data: nextEvent } = await admin
      .from("events")
      .select("id")
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextEvent?.id) {
      console.error("[whatsapp] no event available to attach thread to");
      return;
    }

    const { data: created, error } = await admin
      .from("admin_qa_threads")
      .insert({
        event_id: nextEvent.id,
        rider_user_id: profile?.id ?? null,
        channel: "whatsapp",
        wa_phone: phone,
        wa_name: waName,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      console.error("[whatsapp] thread insert failed", error);
      return;
    }
    threadId = created.id as string;
  }

  const { error: msgErr } = await admin.from("admin_qa_messages").insert({
    thread_id: threadId,
    author_id: null,
    body,
    is_admin_msg: false,
    is_bot: false,
  });
  if (msgErr) {
    console.error("[whatsapp] message insert failed", msgErr);
    return;
  }

  await admin
    .from("admin_qa_threads")
    .update({ last_message_at: new Date().toISOString(), wa_name: waName ?? undefined })
    .eq("id", threadId);
}
