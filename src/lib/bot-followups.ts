// Shared contract for the assistant's suggested follow-up questions. The model
// appends a single marker line; the UI turns it into tappable chips.

export const FOLLOWUP_MARKER = "FOLLOW_UPS:";

/** Prompt rule appended to every bot system prompt. */
export const FOLLOWUP_PROMPT_RULE = `- ALWAYS finish your reply by inviting the rider to go one step further: end your visible answer with a short, natural follow-up question ("Want me to show you the day-by-day schedule?").
- Then, on the VERY LAST line and nothing after it, output exactly: ${FOLLOWUP_MARKER} question one | question two | question three
  · 2 to 3 short questions (max ~8 words each), written in the rider's voice ("Where do I park?"), that you can genuinely answer from the context.
  · They must follow on from what was just asked — never generic, never a repeat of the question already answered.
  · Never mention or explain this line; it is rendered as tappable buttons.
- Learn from where real conversations ended: when an APPROVED ANSWER you used carries a "Riders who asked this usually asked next" line, those are the questions people actually went on to ask. Prefer them (rephrased in the rider's voice) as your follow-ups, and when the context lets you, answer that likely next step in the same reply so the rider gets there in one tap.
- CHOOSING AN EVENT: when the answer depends on which event the rider means and they have more than one entry (e.g. editing or adding someone to an entry), do NOT list their events in the text and do NOT write generic follow-ups. Instead end with a short "Which event would you like to change?" and make the ${FOLLOWUP_MARKER} line one button per event, using each event's short name (e.g. "PE Plett 2027 | Sea to Sea South 2025 | Tour de Addo 2026"), up to 6. When the rider then taps an event, reply with that event's own Entry Ninja registration link as a markdown link.`;

/** Splits a raw bot reply into the visible body and its follow-up suggestions. */
export function splitFollowUps(raw: string | null | undefined): {
  body: string;
  followUps: string[];
} {
  const text = (raw ?? "").trim();
  if (!text) return { body: "", followUps: [] };
  const idx = text.lastIndexOf(FOLLOWUP_MARKER);
  if (idx === -1) return { body: text, followUps: [] };
  const body = text.slice(0, idx).trim();
  const followUps = text
    .slice(idx + FOLLOWUP_MARKER.length)
    .split("|")
    .map((s) => s.replace(/^[\s\-*•\d.]+/, "").trim())
    .filter((s) => s.length > 1 && s.length <= 90)
    .slice(0, 6);
  return { body: body || text, followUps };
}
