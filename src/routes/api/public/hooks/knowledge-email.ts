// Secret intake for forwarded rider emails / documents. A mailbox rule (Gmail,
// Outlook, Cloudflare Email Routing, Zapier…) POSTs the message here; the app
// cleans, redacts and drafts it into the knowledge base awaiting approval.
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

type Payload = { from?: string; subject?: string; text?: string; body?: string; html?: string };

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export const Route = createFileRoute("/api/public/hooks/knowledge-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["KNOWLEDGE_INTAKE_SECRET"] ?? "";
        const provided =
          request.headers.get("x-intake-secret") ??
          request.headers.get("authorization")?.replace("Bearer ", "") ??
          new URL(request.url).searchParams.get("key") ??
          "";

        if (!secret || provided !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let payload: Payload = {};
        try {
          const ct = request.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            payload = (await request.json()) as Payload;
          } else {
            const form = await request.formData();
            payload = {
              from: String(form.get("from") ?? ""),
              subject: String(form.get("subject") ?? ""),
              text: String(form.get("text") ?? form.get("body") ?? ""),
              html: String(form.get("html") ?? ""),
            };
          }
        } catch {
          return new Response(JSON.stringify({ error: "Bad payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const raw = (payload.text || payload.body || (payload.html ? stripHtml(payload.html) : "")).trim();
        if (raw.length < 40) {
          return new Response(JSON.stringify({ error: "Nothing to learn from" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const bodyHash = createHash("sha256").update(raw).digest("hex");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: existing } = await supabaseAdmin
          .from("knowledge_intake")
          .select("id")
          .eq("body_hash", bodyHash)
          .maybeSingle();
        if (existing?.id) {
          return new Response(JSON.stringify({ success: true, duplicate: true }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: intake, error: insertErr } = await supabaseAdmin
          .from("knowledge_intake")
          .insert({
            from_address: payload.from?.slice(0, 300) ?? null,
            subject: payload.subject?.slice(0, 300) ?? null,
            raw_body: raw.slice(0, 40000),
            body_hash: bodyHash,
            status: "received",
          })
          .select("id")
          .single();
        if (insertErr) {
          console.error("[knowledge-email] insert failed", insertErr);
          return new Response(JSON.stringify({ error: insertErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { ingestKnowledge } = await import("@/lib/knowledge-ingest.server");
          const result = await ingestKnowledge(supabaseAdmin as any, {
            text: raw,
            sourceKind: "email",
            sourceRef: payload.subject ?? null,
          });
          await supabaseAdmin
            .from("knowledge_intake")
            .update({
              status: result.ok ? "processed" : "skipped",
              error: result.ok ? null : result.reason,
              knowledge_id: result.ok ? result.id : null,
              processed_at: new Date().toISOString(),
            })
            .eq("id", intake.id);

          return new Response(JSON.stringify({ success: true, learned: result.ok }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[knowledge-email] ingest failed", err);
          await supabaseAdmin
            .from("knowledge_intake")
            .update({ status: "failed", error: (err as Error).message })
            .eq("id", intake.id);
          return new Response(JSON.stringify({ success: false }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
