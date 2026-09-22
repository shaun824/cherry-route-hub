// Server-only: the "teach the assistant" pipeline. Takes a typed message and
// (optionally) a screenshot, photo, voice note or PDF from an admin, pulls the
// text out of it, and drafts a single reusable knowledge note. Nothing is saved
// here — the admin confirms the draft first.
import { cleanForKnowledge } from "@/lib/knowledge-redact";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export type TeachCategory = "ops" | "product" | "suppliers" | "policies" | "general";
export type TeachTier = "public" | "internal";

export type TeachAttachment = {
  kind: "image" | "audio" | "pdf";
  mimeType: string;
  /** Raw base64 (no data: prefix). */
  dataBase64: string;
  filename?: string | null;
};

export type TeachDraft = {
  useful: boolean;
  title: string;
  summary: string;
  body: string;
  category: TeachCategory;
  tier: TeachTier;
  reason: string;
};

const CATEGORIES: TeachCategory[] = ["ops", "product", "suppliers", "policies", "general"];

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** Pull the plain text out of a Responses API payload. */
function responseText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const chunks: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const part of item?.content ?? []) {
      if (typeof part?.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("").trim();
}

async function callResponses(input: unknown[], instructions: string): Promise<string> {
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: MODEL,
      instructions,
      reasoning: { effort: "low" },
      input,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[teach] gateway error", res.status, detail);
    if (res.status === 429) throw new Error("The assistant is busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("The AI workspace is out of credit, so I can't learn this right now.");
    throw new Error("I couldn't read that just now — please try again.");
  }
  return responseText(await res.json());
}

// ---------- step 1: get text out of the attachment ----------

const IMAGE_INSTRUCTIONS = `You are reading a screenshot or photo that a South African event organiser (Red Cherry Events) has sent so their assistant can learn from it.

Write out everything factual the picture contains: transcribe all visible text exactly (headings, tables, times, quantities, names of suppliers, places), then briefly describe anything meaningful the text alone doesn't convey (a layout, a diagram, a marked position on a map).

Plain text only. Do not summarise away detail, do not add anything that is not visible, and do not comment on the image quality.`;

const PDF_INSTRUCTIONS = `You are reading a document a South African event organiser (Red Cherry Events) has sent so their assistant can learn from it. Write out its full factual content as plain text — keep every time, quantity, place, procedure, supplier and contact. Do not add anything that is not in the document.`;

async function transcribeAudio(att: TeachAttachment): Promise<string> {
  const bytes = base64ToBytes(att.dataBase64);
  const mime = (att.mimeType || "audio/webm").split(";")[0];
  const ext =
    ({ "audio/webm": "webm", "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg" } as Record<string, string>)[mime] ??
    "webm";

  const form = new FormData();
  form.append("model", "google/gemini-3.5-transcribe");
  form.append("file", new Blob([bytes as unknown as BlobPart], { type: mime.startsWith("audio/") ? mime : "audio/webm" }), `note.${ext}`);

  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[teach] transcription error", res.status, detail);
    throw new Error("I couldn't make out that voice note — try recording it again.");
  }
  const j = (await res.json()) as { text?: string };
  return (j.text ?? "").trim();
}

export async function extractAttachmentText(att: TeachAttachment): Promise<string> {
  if (att.kind === "audio") return transcribeAudio(att);

  const mime = (att.mimeType || "").split(";")[0];
  if (att.kind === "image") {
    return callResponses(
      [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Read this picture." },
            { type: "input_image", image_url: `data:${mime || "image/jpeg"};base64,${att.dataBase64}` },
          ],
        },
      ],
      IMAGE_INSTRUCTIONS,
    );
  }

  return callResponses(
    [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Read this document." },
          {
            type: "input_file",
            filename: att.filename || "document.pdf",
            file_data: `data:${mime || "application/pdf"};base64,${att.dataBase64}`,
          },
        ],
      },
    ],
    PDF_INSTRUCTIONS,
  );
}

// ---------- step 2: draft the note ----------

const DRAFT_INSTRUCTIONS = `You turn material from a South African event organiser (Red Cherry Events — mountain bike and motorbike stage events) into ONE reusable knowledge note for their rider and crew assistant.

The material comes from an admin who is deliberately teaching the assistant: a typed message, a transcribed voice note, a screenshot or a document.

Respond with JSON only, no code fences:
{"useful": boolean, "title": string, "summary": string, "body": string, "category": "ops"|"product"|"suppliers"|"policies"|"general", "tier": "public"|"internal", "reason": string}

Rules:
- "body": the durable knowledge in clear neutral prose or short bullets. Keep every concrete fact (times, places, quantities, steps, who does what, links). Drop greetings and chit-chat.
- "title": a short descriptive label. "summary": one sentence.
- STRIP, never repeat: other people's personal details (names, phone numbers, email addresses, ID numbers, entry references, home addresses), and commercial figures tied to sponsorship, contracts, rates, costs, margins, supplier pricing or pay. Published rider-facing prices (entry fees, merchandise) may stay. On-site emergency and crew contact numbers in an operational plan may stay.
- tier="internal" for crew/ops-only material (build, staffing, safety plans, commercial arrangements, internal process). tier="public" for rider-facing event, product and policy knowledge.
- category: "ops" = how events are run; "product" = entries, packages, merchandise; "suppliers" = suppliers and sponsors; "policies" = refunds, transfers, T&Cs; "general" = anything else.
- useful=false only when there is genuinely nothing reusable. Explain briefly in "reason".
- Never invent facts that are not in the material.
- If an EXISTING NOTE is given, return the full corrected/merged note in "body": apply the new material as a correction or addition, keep everything still true, and remove anything the new material contradicts. Keep the same subject.`;

function safeParse(raw: string): TeachDraft | null {
  const text = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as TeachDraft;
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
  } catch {
    return null;
  }
}

export async function draftTeachNote(opts: {
  message: string;
  extracted?: string | null;
  existing?: { title: string; body: string } | null;
}): Promise<{ draft: TeachDraft; redactions: string[] }> {
  const parts: string[] = [];
  if (opts.existing) {
    parts.push(`EXISTING NOTE — "${opts.existing.title}":\n${opts.existing.body}`);
  }
  if (opts.message.trim()) parts.push(`WHAT THE ADMIN SAID:\n${opts.message.trim()}`);
  if (opts.extracted?.trim()) parts.push(`FROM THE ATTACHMENT:\n${opts.extracted.trim()}`);

  const material = parts.join("\n\n");
  if (material.replace(/\s/g, "").length < 20) {
    throw new Error("There's not enough there for me to learn from yet.");
  }

  const raw = await callResponses([{ role: "user", content: material }], DRAFT_INSTRUCTIONS);
  const draft = safeParse(raw);
  if (!draft) throw new Error("I couldn't turn that into a note — try saying it a different way.");

  const safeBody = cleanForKnowledge(draft.body);
  const safeSummary = cleanForKnowledge(draft.summary);
  return {
    draft: { ...draft, body: safeBody.text, summary: safeSummary.text },
    redactions: Array.from(new Set([...safeBody.notes, ...safeSummary.notes])),
  };
}
