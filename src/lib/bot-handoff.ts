// Shared between the assistant bot (server) and the chat UI (client) so both
// agree on what "the bot couldn't answer this" looks like.

export const BOT_MISS_REPLY =
  "I couldn't find a confident answer for that in the event details or website — I've flagged it for a Red Cherry admin to reply personally here, and you can also reach the team right away on WhatsApp below. 🍒";


/** True when a bot message is the "I don't know, an admin will reply" fallback. */
export function isBotMiss(body: string | null | undefined): boolean {
  if (!body) return false;
  return body.trim().startsWith("I couldn't find a confident answer");
}
