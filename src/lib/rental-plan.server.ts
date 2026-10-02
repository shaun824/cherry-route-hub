// Server-only: read an uploaded plan of action (PDF, image, Word or pasted
// text) and turn it into a structured rental event draft.
import { unzipSync, strFromU8 } from "fflate";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export type PlanAttachment = { mimeType: string; dataBase64: string; filename?: string | null };

export type RentalPlanDraft = {
  name: string;
  client_name: string | null;
  client_contact: string | null;
  location: string | null;
  event_date: string | null; // YYYY-MM-DD
  build_date: string | null;
  breakdown_date: string | null;
  description: string;
  runSheet: { day_label: string; start_time: string | null; end_time: string | null; task: string; detail: string | null; location: string | null }[];
  equipment: { name: string; qty: number | null; qty_label: string | null; size_spec: string | null }[];
  changes?: string[];
  needs?: string[];
};

function b64ToBytes(b64: string) {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function docxText(b64: string): string {
  const files = unzipSync(b64ToBytes(b64), { filter: (f) => f.name === "word/document.xml" });
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("That Word file looks empty.");
  return strFromU8(xml)
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 120_000);
}

const INSTRUCTIONS = `You read a Red Cherry Events infrastructure-rental plan of action (weddings, camps, corporate days) and return ONLY a JSON object:
{"name":string,"client_name":string|null,"client_contact":string|null,"location":string|null,"event_date":"YYYY-MM-DD"|null,"build_date":"YYYY-MM-DD"|null,"breakdown_date":"YYYY-MM-DD"|null,"description":string,"runSheet":[{"day_label":string,"start_time":"HH:MM"|null,"end_time":"HH:MM"|null,"task":string,"detail":string|null,"location":string|null}],"equipment":[{"name":string,"qty":number|null,"qty_label":string|null,"size_spec":string|null}]}
Rules: event_date is the first day guests arrive. description is a client-friendly overview in short paragraphs (dates, venue, capacity, what is supplied) — never prices, costs or internal crew notes. runSheet lists build, event and strike tasks in order. equipment lists physical kit supplied. Only use facts in the document; use null when unknown. Never invent times.
Be as detailed as possible: the description should cover every client-relevant fact in the document (dates, arrival/departure, venue, capacity, layout, accommodation, bedding, ablutions, services, safety, contacts), and runSheet/equipment must include every task and item mentioned — never drop or summarise away detail.`;

const EDIT_INSTRUCTIONS = `\nThis input is the CURRENT LIVE PLAN in sections (# EVENT DETAILS, # CLIENT DESCRIPTION, # RUN SHEET, # EQUIPMENT, # EXTRA NOTES FOR THE AI), possibly followed by a # CHANGE REQUEST written by staff in plain words. Treat the live plan as the source of truth: keep every existing fact, task and equipment line unless staff changed or removed it. Apply the CHANGE REQUEST and any EXTRA NOTES exactly and consistently everywhere they matter (e.g. new dates move the run sheet days and description; new headcount updates capacity, tents, beds and equipment quantities only where the request makes the numbers clear). Keep run-sheet day headings (## ...) as day_label and keep task order. Keep the description full and well structured, but never add facts that are not in the text.
Also add two fields to the JSON: "changes": string[] — short plain-English bullets of exactly what you changed versus the live plan (e.g. "Event date moved from 13 Dec to 20 Dec"); "needs": string[] — short bullets of follow-ups staff must sort out because of the change (e.g. "Order 10 more beds", "Confirm new strike times") or details still missing. Use [] when none.`;

export async function draftRentalPlan(text: string, att?: PlanAttachment | null, mode: "import" | "edit" = "import"): Promise<RentalPlanDraft> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const content: any[] = [];
  let body = text.trim();
  if (att) {
    const mime = att.mimeType || "";
    if (mime.includes("wordprocessingml") || /\.docx$/i.test(att.filename ?? "")) {
      body = `${body}\n\n--- Document ---\n${docxText(att.dataBase64)}`;
    } else if (mime.startsWith("image/")) {
      content.push({ type: "input_image", image_url: `data:${mime};base64,${att.dataBase64}` });
    } else if (mime === "application/pdf" || /\.pdf$/i.test(att.filename ?? "")) {
      content.push({ type: "input_file", filename: att.filename || "plan.pdf", file_data: `data:application/pdf;base64,${att.dataBase64}` });
    } else if (mime.startsWith("text/")) {
      body = `${body}\n\n${new TextDecoder().decode(b64ToBytes(att.dataBase64))}`;
    } else {
      throw new Error("Upload a PDF, Word (.docx), image or text file.");
    }
  }
  if (!body && !content.length) throw new Error("Add the plan text or upload a file.");
  content.unshift({ type: "input_text", text: `Return the plan as a json object.\n\n${body || "Read the attached plan of action."}` });

  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      instructions: mode === "edit" ? INSTRUCTIONS + EDIT_INSTRUCTIONS : INSTRUCTIONS,
      reasoning: { effort: "low" },
      text: { format: { type: "json_object" } },
      input: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(150_000),
  });
  if (!res.ok) {
    console.error("[rental-plan] gateway", res.status, await res.text().catch(() => ""));
    if (res.status === 429) throw new Error("Busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("The AI workspace is out of credit.");
    throw new Error("Couldn't read that plan — please try again.");
  }
  const payload: any = await res.json();
  let out = typeof payload.output_text === "string" ? payload.output_text : "";
  if (!out) for (const it of payload.output ?? []) for (const p of it.content ?? []) if (typeof p.text === "string") out += p.text;
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Couldn't read that plan — please try again.");
  const d = JSON.parse(m[0]);
  const date = (v: any) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const time = (v: any) => (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) ? v : null);
  const str = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    name: str(d.name) ?? "New rental",
    client_name: str(d.client_name),
    client_contact: str(d.client_contact),
    location: str(d.location),
    event_date: date(d.event_date),
    build_date: date(d.build_date),
    breakdown_date: date(d.breakdown_date),
    description: str(d.description) ?? "",
    runSheet: (Array.isArray(d.runSheet) ? d.runSheet : []).filter((t: any) => str(t?.task)).slice(0, 200).map((t: any) => ({
      day_label: str(t.day_label) ?? "Plan", start_time: time(t.start_time), end_time: time(t.end_time),
      task: str(t.task)!, detail: str(t.detail), location: str(t.location),
    })),
    equipment: (Array.isArray(d.equipment) ? d.equipment : []).filter((g: any) => str(g?.name)).slice(0, 200).map((g: any) => ({
      name: str(g.name)!, qty: Number.isFinite(Number(g.qty)) && g.qty !== null ? Math.round(Number(g.qty)) : null,
      qty_label: str(g.qty_label), size_spec: str(g.size_spec),
    })),
    changes: (Array.isArray(d.changes) ? d.changes : []).map(str).filter(Boolean).slice(0, 30) as string[],
    needs: (Array.isArray(d.needs) ? d.needs : []).map(str).filter(Boolean).slice(0, 30) as string[],
  };
}
