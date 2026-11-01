import { describe, expect, it } from "vitest";
import {
  ASSISTANT_NUDGE_KEY,
  assistantNudgeSeenValue,
  shouldShowAssistantNudge,
} from "./assistant-nudge";

describe("assistant hint is shown once ever", () => {
  it("shows on a browser that has never seen it", () => {
    expect(shouldShowAssistantNudge(null)).toBe(true);
  });

  it("never shows again once it has been put on screen", () => {
    expect(shouldShowAssistantNudge(assistantNudgeSeenValue())).toBe(false);
  });

  it("keeps using the same stored key so old visitors stay muted", () => {
    expect(ASSISTANT_NUDGE_KEY).toBe("rce-assistant-nudge-seen");
  });
});
