import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { liveReviewEvent, reviewStartAt } from "./review-event";
import { trackingWindow } from "./tracking-window";
import type { Event } from "./mock-data";

const now = new Date(2026, 9, 28, 21, 40, 10); // 21:40 local, after the normal 18:00 close

describe("review event", () => {
  it("starts 15 minutes from the reviewer's current time", () => {
    const s = reviewStartAt(now);
    assert.equal(s.getHours(), 21);
    assert.equal(s.getMinutes(), 55);
  });

  it("moves every day to today and marks the event live", () => {
    const ev = liveReviewEvent({ date: "2020-01-01T00:00:00Z", status: "upcoming", days: [{ id: "d1", date: "2020-01-01" }], schedule: [{ time: "07:30", label: "Review – 20 km start", dayId: "d1" }] }, now);
    assert.equal(ev.status, "live");
    assert.equal((ev.days as { date: string }[])[0].date, "2026-10-28");
    assert.equal((ev.schedule as { time: string }[])[0].time, "21:55");
  });

  it("keeps tracking open at any hour, even after a result exists", () => {
    const ev = { ...liveReviewEvent({ date: "", days: [], schedule: [] }, now), isReviewEvent: true } as unknown as Event;
    assert.equal(trackingWindow(ev, { now, resultsPublished: true }).open, true);
  });
});
