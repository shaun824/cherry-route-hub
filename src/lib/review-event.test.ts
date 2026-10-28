import { describe, expect, it } from "vitest";
import { liveReviewEvent, reviewStartAt } from "./review-event";
import { trackingWindow } from "./tracking-window";
import type { Event } from "./mock-data";

const now = new Date(2026, 9, 28, 21, 40, 10); // 21:40 local, after the normal 18:00 close

describe("review event", () => {
  it("starts 15 minutes from the reviewer's current time", () => {
    const s = reviewStartAt(now);
    expect(s.getHours()).toBe(21);
    expect(s.getMinutes()).toBe(55);
  });

  it("moves every day to today and marks the event live", () => {
    const ev = liveReviewEvent({ date: "2020-01-01T00:00:00Z", status: "upcoming", days: [{ id: "d1", date: "2020-01-01" }], schedule: [{ time: "07:30", label: "Review – 20 km start", dayId: "d1" }] }, now);
    expect(ev.status).toBe("live");
    expect((ev.days as { date: string }[])[0].date).toBe("2026-10-28");
    expect((ev.schedule as { time: string }[])[0].time).toBe("21:55");
  });

  it("keeps tracking open at any hour, even after a result exists", () => {
    const ev = { ...liveReviewEvent({ date: "", days: [], schedule: [] }, now), isReviewEvent: true } as unknown as Event;
    expect(trackingWindow(ev, { now, resultsPublished: true }).open).toBe(true);
  });
});
