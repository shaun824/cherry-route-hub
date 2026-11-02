import { describe, expect, it } from "vitest";
import { eventEndMs, isHiddenFromBackend } from "./event-window";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("event-window multi-day rules", () => {
  // Ride For Change 2026: starts 1 Nov, runs 9 days. On day 2 it must still
  // be treated as running — the Entry Ninja sync archived it on start date
  // alone and it vanished from race control mid-event.
  const rideForChange = {
    event_date: "2026-11-01T05:00:00+00:00",
    days: Array.from({ length: 9 }, (_, i) => ({ id: `d${i + 1}`, label: `Day ${i + 1}`, routes: [] })),
  };
  const day2 = new Date("2026-11-02T08:00:00+00:00").getTime();

  it("a 9-day event ends on its last day, not its first", () => {
    const start = new Date("2026-11-01T05:00:00+00:00").getTime();
    expect(eventEndMs(rideForChange)).toBe(start + 8 * DAY_MS);
  });

  it("is not hidden from crew lists on day 2", () => {
    expect(isHiddenFromBackend(rideForChange, day2)).toBe(false);
  });

  it("is not past the archive cutoff on day 2", () => {
    const cutoff = day2 - DAY_MS;
    expect(eventEndMs(rideForChange) < cutoff).toBe(false);
  });

  it("a single-day event is past the archive cutoff two days later", () => {
    const oneDay = { event_date: "2026-11-01T05:00:00+00:00", days: [] };
    const cutoff = new Date("2026-11-03T08:00:00+00:00").getTime() - DAY_MS;
    expect(eventEndMs(oneDay) < cutoff).toBe(true);
  });
});
