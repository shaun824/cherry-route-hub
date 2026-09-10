// Visual email builder: an email is a list of blocks. Anything an admin drops
// into the builder is stored as one of these, and the email template renders
// them in order. Plain data only — no HTML is ever stored or rendered raw.

export type EmailBlockAlign = "left" | "center" | "right";

export type EmailBlock =
  | { id: string; type: "heading"; text: string; align?: EmailBlockAlign; size?: "xl" | "lg" | "md" }
  | { id: string; type: "text"; text: string; align?: EmailBlockAlign }
  | { id: string; type: "image"; url: string; caption?: string | null; href?: string | null }
  | { id: string; type: "columns"; items: { url: string; caption?: string | null; href?: string | null }[] }
  | { id: string; type: "button"; label: string; url: string; align?: EmailBlockAlign }
  | { id: string; type: "list"; items: string[]; ordered?: boolean }
  | { id: string; type: "quote"; text: string; cite?: string | null }
  | { id: string; type: "callout"; title?: string | null; text: string }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; size?: "sm" | "md" | "lg" };

export type EmailBlockType = EmailBlock["type"];

export const BLOCK_LIBRARY: { type: EmailBlockType; label: string; hint: string }[] = [
  { type: "heading", label: "Heading", hint: "A big line of text" },
  { type: "text", label: "Paragraph", hint: "Normal writing" },
  { type: "image", label: "Picture", hint: "One full-width picture" },
  { type: "columns", label: "Two pictures", hint: "Side by side" },
  { type: "button", label: "Button", hint: "A tappable link" },
  { type: "list", label: "Bullet list", hint: "Short points" },
  { type: "callout", label: "Highlight box", hint: "Stands out from the rest" },
  { type: "quote", label: "Quote", hint: "A quoted line" },
  { type: "divider", label: "Divider line", hint: "Separates sections" },
  { type: "spacer", label: "Blank space", hint: "Breathing room" },
];

export function newBlockId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `b${Math.random().toString(36).slice(2)}`;
}

export function makeBlock(type: EmailBlockType): EmailBlock {
  const id = newBlockId();
  switch (type) {
    case "heading":
      return { id, type, text: "New heading", align: "left", size: "lg" };
    case "text":
      return { id, type, text: "Write something here.", align: "left" };
    case "image":
      return { id, type, url: "", caption: null, href: null };
    case "columns":
      return { id, type, items: [{ url: "", caption: null }, { url: "", caption: null }] };
    case "button":
      return { id, type, label: "Open your event page", url: "", align: "center" };
    case "list":
      return { id, type, items: ["First point", "Second point"], ordered: false };
    case "quote":
      return { id, type, text: "Something worth quoting.", cite: null };
    case "callout":
      return { id, type, title: "Good to know", text: "Something important." };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, size: "md" };
  }
}

export function blockLabel(b: EmailBlock): string {
  const entry = BLOCK_LIBRARY.find((l) => l.type === b.type);
  return entry?.label ?? b.type;
}

/** One-line summary of a block, for the builder's list of parts. */
export function blockSummary(b: EmailBlock): string {
  switch (b.type) {
    case "heading":
    case "text":
    case "quote":
      return b.text?.slice(0, 70) || "Empty";
    case "callout":
      return [b.title, b.text].filter(Boolean).join(" — ").slice(0, 70) || "Empty";
    case "image":
      return b.url ? b.url.split("/").pop() || b.url : "No picture chosen yet";
    case "columns":
      return `${b.items.filter((i) => i.url).length} of ${b.items.length} pictures set`;
    case "button":
      return `${b.label || "Button"} → ${b.url || "no link yet"}`;
    case "list":
      return b.items.filter(Boolean).slice(0, 3).join(" · ") || "Empty";
    case "divider":
      return "A line across the email";
    case "spacer":
      return `${b.size ?? "md"} gap`;
  }
}

/** Accepts anything stored in the database and returns a safe block list. */
export function normaliseBlocks(raw: unknown): EmailBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: EmailBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, any>;
    const id = String(b['id'] ?? newBlockId());
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const align = (["left", "center", "right"] as const).includes(b['align']) ? b['align'] : "left";
    switch (b['type']) {
      case "heading":
        out.push({ id, type: "heading", text: str(b['text']), align, size: b['size'] === "xl" || b['size'] === "md" ? b['size'] : "lg" });
        break;
      case "text":
        out.push({ id, type: "text", text: str(b['text']), align });
        break;
      case "image":
        out.push({ id, type: "image", url: str(b['url']), caption: b['caption'] ? str(b['caption']) : null, href: b['href'] ? str(b['href']) : null });
        break;
      case "columns":
        out.push({
          id,
          type: "columns",
          items: (Array.isArray(b['items']) ? b['items'] : []).slice(0, 2).map((i: any) => ({
            url: str(i?.url),
            caption: i?.caption ? str(i.caption) : null,
            href: i?.href ? str(i.href) : null,
          })),
        });
        break;
      case "button":
        out.push({ id, type: "button", label: str(b['label']) || "Open", url: str(b['url']), align: align === "left" ? "left" : align });
        break;
      case "list":
        out.push({
          id,
          type: "list",
          items: (Array.isArray(b['items']) ? b['items'] : []).map((i: any) => str(i)).filter(Boolean),
          ordered: !!b['ordered'],
        });
        break;
      case "quote":
        out.push({ id, type: "quote", text: str(b['text']), cite: b['cite'] ? str(b['cite']) : null });
        break;
      case "callout":
        out.push({ id, type: "callout", title: b['title'] ? str(b['title']) : null, text: str(b['text']) });
        break;
      case "divider":
        out.push({ id, type: "divider" });
        break;
      case "spacer":
        out.push({ id, type: "spacer", size: b['size'] === "sm" || b['size'] === "lg" ? b['size'] : "md" });
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * Turns an older plain-text email (written before the builder existed) into
 * blocks, so opening it in the builder shows the same email, editable.
 */
export function blocksFromLegacyStep(step: {
  body?: string | null;
  image_urls?: unknown;
  cta_label?: string | null;
  cta_url?: string | null;
}): EmailBlock[] {
  const out: EmailBlock[] = [];
  const paragraphs = String(step.body ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const p of paragraphs) out.push({ id: newBlockId(), type: "text", text: p, align: "left" });

  const images = Array.isArray(step.image_urls) ? step.image_urls : [];
  for (const url of images) {
    if (typeof url === "string" && url.trim()) out.push({ id: newBlockId(), type: "image", url: url.trim(), caption: null, href: null });
  }
  if (step.cta_url?.trim()) {
    out.push({
      id: newBlockId(),
      type: "button",
      label: step.cta_label?.trim() || "Open your event page",
      url: step.cta_url.trim(),
      align: "center",
    });
  }
  return out;
}

/** Plain-text version of the blocks, kept in the old body field as a fallback. */
export function blocksToPlainText(blocks: EmailBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
      case "text":
      case "quote":
        if (b.text?.trim()) parts.push(b.text.trim());
        break;
      case "callout":
        parts.push([b.title, b.text].filter(Boolean).join("\n").trim());
        break;
      case "list":
        parts.push(b.items.filter(Boolean).map((i) => `• ${i}`).join("\n"));
        break;
      default:
        break;
    }
  }
  return parts.filter(Boolean).join("\n\n");
}
