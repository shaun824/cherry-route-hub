// Server-only: turns raw material (forwarded rider emails, pasted documents,
// ops notes) into clean, redacted knowledge entries the assistant can use.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanForKnowledge } from "@/lib/knowledge-redact";

type AnyClient = SupabaseClient<any, any, any>;

export type KnowledgeCategory = "ops" | "product" | "suppliers" | "policies" | "general";
export type KnowledgeTier = "public" | "internal";

export type KnowledgeDraft = {
  useful: boolean;
  title: string;
  summary: string;
  body: string;
  category: KnowledgeCategory;
  tier: KnowledgeTier;
  reason: string;
};

const CATEGORIES: KnowledgeCategory[] = ["ops", "product", "suppliers", "policies", "general"];

const SYSTEM = `You turn raw internal material from a South African event organiser (Red Cherry Events — mountain bike and motorbike stage events) into ONE reusable knowledge note for their rider assistant.

The material may be a forwarded rider email, a reply the team sent, an operations playbook, a product/entry description, a supplier brief or a policy.

Respond with JSON only:
{"useful": boolean, "title": string, "summary": string, "body": string, "category": "ops"|"product"|"suppliers"|"policies"|"general", "tier": "public"|"internal", "reason": string}

Rules:
- "body": the durable knowledge, rewritten in clear neutral prose or short bullets. Keep concrete facts (times, places, steps, what riders get, links). Drop greetings, chit-chat and anything about one specific person.
- "title": a short descriptive label. "summary": one sentence.
- STRIP, never repeat: personal details (names, phone numbers, email addresses, ID numbers, entry references, addresses of individuals), and every monetary or commercial figure tied to sponsorship, contracts, rates, costs, margins, supplier pricing or pay. Published rider-facing prices (entry fees, merchandise prices) may stay only if the material clearly presents them as public pricing.
- tier="internal" when the note covers commercial arrangements, costs, contracts, staffing, or internal-only process that riders should never be told. tier="public" for rider-facing product, event and policy knowledge.
- category: "ops" = how events are run (setup, registration, crew, timing, safety); "product" = entries, packages, merchandise, inclusions; "suppliers" = suppliers and sponsors and what they deliver; "policies" = refunds, transfers, T&Cs, standard wording; "general" = anything else.
- useful=false when the material is a one-off personal matter, has no reusable information, or is pure chit-chat. Explain briefly in "reason".
- Never invent facts that are not in the material.`;

async function draftFromText(text: string): Promise<KnowledgeDraft | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `MATERIAL:\n\n${text}` },
        ],
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      console.error("[knowledge] AI error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = j.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText) as KnowledgeDraft;
    if (!parsed || typeof parsed.body !== "string") return null;
    return {
      useful: parsed.useful !== false,
      title: String(parsed.title ?? "Untitled note").slice(0, 200),
      summary: String(parsed.summary ?? "").slice(0, 500),
      body: String(parsed.body ?? "").slice(0, 8000),
      category: CATEGORIES.includes(parsed.category) ? parsed.category : "general",
      tier: parsed.tier === "internal" ? "internal" : "public",
      reason: String(parsed.reason ?? "").slice(0, 300),
    };
  } catch (e) {
    console.error("[knowledge] draft failed", e);
    return null;
  }
}

export type IngestInput = {
  text: string;
  sourceKind: "email" | "paste" | "chat";
  sourceRef?: string | null;
  eventId?: string | null;
  tier?: KnowledgeTier | null;
  category?: KnowledgeCategory | null;
  createdBy?: string | null;
  /** Paste flow can save straight to approved; email intake always waits. */
  status?: "suggested" | "approved";
};

export type IngestResult =
  | { ok: true; id: string; draft: KnowledgeDraft; redactions: string[] }
  | { ok: false; reason: string; draft?: KnowledgeDraft; redactions: string[] };

/** Clean → redact → draft → store as a knowledge entry awaiting approval. */
export async function ingestKnowledge(admin: AnyClient, input: IngestInput): Promise<IngestResult> {
  const { text, notes } = cleanForKnowledge(input.text);
  if (text.trim().length < 40) {
    return { ok: false, reason: "Not enough content to learn from.", redactions: notes };
  }

  const draft = await draftFromText(text);
  if (!draft) {
    return { ok: false, reason: "The drafting pass failed — try again.", redactions: notes };
  }
  if (!draft.useful) {
    return {
      ok: false,
      reason: draft.reason || "Nothing reusable in this material.",
      draft,
      redactions: notes,
    };
  }

  // Second redaction pass over the model's own output — cheap insurance.
  const safeBody = cleanForKnowledge(draft.body);
  const safeSummary = cleanForKnowledge(draft.summary);
  const redactions = Array.from(new Set([...notes, ...safeBody.notes, ...safeSummary.notes]));

  const status = input.status ?? "suggested";
  const { data, error } = await admin
    .from("business_knowledge")
    .insert({
      title: draft.title,
      body: safeBody.text,
      summary: safeSummary.text || null,
      category: input.category ?? draft.category,
      event_id: input.eventId ?? null,
      tier: input.tier ?? draft.tier,
      status,
      source_kind: input.sourceKind,
      source_ref: input.sourceRef ?? null,
      redaction_notes: redactions,
      created_by: input.createdBy ?? null,
      approved_by: status === "approved" ? (input.createdBy ?? null) : null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, reason: error.message, draft, redactions };
  return { ok: true, id: data.id as string, draft, redactions };
}

// ---------- reading knowledge back into the bots ----------

const STOP = new Set([
  "the", "and", "for", "with", "what", "when", "where", "how", "does", "did", "are", "was",
  "you", "your", "our", "this", "that", "from", "into", "have", "has", "can", "will", "about",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Approved knowledge relevant to a question, ranked by keyword overlap and
 * capped in size. Internal-tier notes are only ever included for admins.
 */
export async function buildKnowledgeContext(
  admin: AnyClient,
  opts: { question: string; eventIds: string[]; includeInternal: boolean; maxChars?: number },
): Promise<string> {
  const { data, error } = await admin
    .from("business_knowledge")
    .select("id, title, summary, body, category, tier, event_id")
    .eq("status", "approved")
    .limit(400);
  if (error) {
    console.error("[knowledge] read failed", error);
    return "";
  }

  const rows = (data ?? []).filter((r: any) => {
    if (r.tier === "internal" && !opts.includeInternal) return false;
    if (r.event_id && !opts.eventIds.includes(r.event_id)) return false;
    return true;
  });
  if (!rows.length) return "";

  const qt = tokens(opts.question);
  const scored = rows
    .map((r: any) => {
      const hay = tokens(`${r.title} ${r.summary ?? ""} ${r.body}`);
      let score = 0;
      for (const t of qt) if (hay.some((h) => h.includes(t) || t.includes(h))) score += 1;
      if (r.event_id) score += 1;
      return { row: r, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 12);

  const cap = opts.maxChars ?? 12000;
  const parts: string[] = [];
  let used = 0;
  const usedIds: string[] = [];
  for (const s of scored) {
    const r = s.row as any;
    const block = `${r.tier === "internal" ? "[INTERNAL — admins only, never repeat to riders] " : ""}${r.title} (${r.category})\n${r.body}`;
    if (used + block.length > cap) break;
    parts.push(block);
    used += block.length;
    usedIds.push(r.id as string);
  }

  if (usedIds.length) {
    // Usage counter is best-effort telemetry for the admin library.
    void Promise.all(
      usedIds.map((id) =>
        admin
          .from("business_knowledge")
          .select("times_used")
          .eq("id", id)
          .maybeSingle()
          .then(({ data: row }: any) =>
            row
              ? admin
                  .from("business_knowledge")
                  .update({ times_used: (row.times_used ?? 0) + 1 })
                  .eq("id", id)
              : null,
          ),
      ),
    ).catch(() => undefined);
  }

  return parts.length ? parts.join("\n\n") : "";
}
