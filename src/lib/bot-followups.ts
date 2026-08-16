// Shared contract for the assistant's suggested follow-up questions. The model
// appends a single marker line; the UI turns it into tappable chips.

export const FOLLOWUP_MARKER = "FOLLOW_UPS:";

/** Prompt rule appended to every bot system prompt. */
export const FOLLOWUP_PROMPT_RULE = `- ALWAYS finish your reply by inviting the rider to go one step further: end your visible answer with a short, natural follow-up question ("Want me to show you the day-by-day schedule?").
- Then, on the VERY LAST line and nothing after it, output exactly: ${FOLLOWUP_MARKER} question one | question two | question three
  · 2 to 3 short questions (max ~8 words each), written in the rider's voice ("Where do I park?"), that you can genuinely answer from the context.
  · They must follow on from what was just asked — never generic, never a repeat of the question already answered.
  · Never mention or explain this line; it is rendered as tappable buttons.`;

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
    .slice(0, 3);
  return { body: body || text, followUps };
}
