import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ASSISTANT_NUDGE_KEY,
  assistantNudgeSeenValue,
  shouldShowAssistantNudge,
} from "./assistant-nudge";

describe("assistant hint is shown once ever", () => {
  it("shows on a browser that has never seen it", () => {
    assert.equal(shouldShowAssistantNudge(null), true);
  });

  it("never shows again once it has been put on screen", () => {
    assert.equal(shouldShowAssistantNudge(assistantNudgeSeenValue()), false);
  });

  it("keeps using the same stored key so old visitors stay muted", () => {
    assert.equal(ASSISTANT_NUDGE_KEY, "rce-assistant-nudge-seen");
  });
});
