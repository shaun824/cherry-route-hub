// The assistant bubble that points at the chat button is a one-off: it appears
// the first time someone opens the app in a browser and never again, whether or
// not they tap it. Riders who already know the assistant exists shouldn't be
// reminded on every visit.
export const ASSISTANT_NUDGE_KEY = "rce-assistant-nudge-seen";
export const ASSISTANT_NUDGE_FLAG = "1";

/** True only when this browser has never seen the hint before. */
export function shouldShowAssistantNudge(storedValue: string | null): boolean {
  return storedValue !== ASSISTANT_NUDGE_FLAG;
}

/** The value to write the moment the hint is put on screen. */
export function assistantNudgeSeenValue(): string {
  return ASSISTANT_NUDGE_FLAG;
}
