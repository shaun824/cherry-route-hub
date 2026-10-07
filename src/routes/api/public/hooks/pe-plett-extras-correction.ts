// One-off: resend the proper PE Plett extras email to riders who only got the plain fallback on 15 Sep.
import { createFileRoute } from "@tanstack/react-router";

const SUBJECT = "We apologize. Here is the right one.";
const WRONG_SUBJECT = "Your booked extras for M&G Investments PE PLETT 2027";

export const Route = createFileRoute("/api/public/hooks/pe-plett-extras-correction")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!apikey || apikey !== expected) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as { mode?: string; testTo?: string; sample?: string };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;
        const { buildPePlettExtrasEmailData } = await import("@/lib/pe-plett-extras.server");
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

        const { data: step } = await admin.from("event_email_steps").select("campaign_id, event_email_campaigns(event_id, events(id, name))").eq("template_name", "pe-plett-extras").limit(1).single();
        const event = step.event_email_campaigns.events;

        const { data: wrong } = await admin.from("email_sends").select("recipient").eq("subject", WRONG_SUBJECT).eq("template", "event-update").limit(1000);
        const { data: right } = await admin.from("email_sends").select("recipient").eq("template", "pe-plett-extras").limit(5000);
        const ok = new Set((right ?? []).map((r: any) => String(r.recipient).toLowerCase()));
        const targets = Array.from(new Set((wrong ?? []).map((r: any) => String(r.recipient).toLowerCase()))) as string[]; void ok;
        const { data: recent } = await admin.from("email_sends").select("recipient").eq("template", "pe-plett-extras").gte("sent_at", new Date(Date.now() - 3 * 3600_000).toISOString()).limit(2000);
        const recentSet = new Set((recent ?? []).map((r: any) => String(r.recipient).toLowerCase()));
        const pending = targets.filter((t) => !recentSet.has(t) && !t.startsWith("placeholder-"));

        const { data: rows } = await admin.from("event_entrants").select("extras, registration_ref, entrants(full_name, email)").eq("event_id", event.id).limit(5000);
        const byEmail = new Map<string, any>();
        for (const r of rows ?? []) { const e = String(r.entrants?.email ?? "").toLowerCase(); if (e) byEmail.set(e, r); }

        const build = (r: any) => ({
          ...buildPePlettExtrasEmailData({
            firstName: String(r?.entrants?.full_name ?? "").trim().split(/\s+/)[0] || undefined,
            eventName: event.name,
            registrationRef: r?.registration_ref ?? null,
            extras: Array.isArray(r?.extras) ? r.extras : [],
          }),
          subjectOverride: SUBJECT,
        });

        if (body.mode === "test") {
          const r = byEmail.get(String(body.sample ?? "").toLowerCase());
          if (!r) return Response.json({ error: "sample rider not found" }, { status: 404 });
          const res = await sendTemplateEmail("pe-plett-extras", String(body.testTo), { templateData: build(r) });
          return Response.json({ test: res, targets: targets.length });
        }
        if (body.mode !== "send") return Response.json({ targets: targets.length, withEntry: targets.filter((t) => byEmail.has(t)).length });

        let sent = 0, suppressed = 0; const errors: string[] = [];
        for (const to of pending) {
          const r = byEmail.get(to);
          if (!r) { errors.push(`${to}: no entry`); continue; }
          try {
            const res = await sendTemplateEmail("pe-plett-extras", to, { templateData: build(r), idempotencyKey: `pe-plett-extras-apology-${to}` });
            res.sent ? sent++ : suppressed++;
          } catch (e) { errors.push(`${to}: ${(e as Error).message}`); if ((e as any)?.status === 429) break; }
        }
        return Response.json({ targets: pending.length, sent, suppressed, errors });
      },
    },
  },
});
