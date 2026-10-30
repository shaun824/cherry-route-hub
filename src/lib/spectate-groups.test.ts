import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupSpectateEvents } from "./spectate-groups";
import { getEventTypeIcon } from "./event-type-icon";
import type { Event } from "./mock-data";

const NOW = new Date("2026-10-30T08:41:00+00:00").getTime();

function event(over: Partial<Event> & { name: string; date: string }): Event {
  return {
    id: over.id ?? over.name,
    externalId: null,
    discipline: "Cycling",
    location: "Somewhere",
    distanceKm: 50,
    status: "upcoming",
    lifecycle: "published",
    heroColor: "#ea580c",
    description: "",
    schedule: [],
    mapQuery: "",
    entered: false,
    ...over,
  } as Event;
}

describe("spectate groups", () => {
  it("puts finished events from this year in Just past, most recent first", () => {
    const { past, upcoming } = groupSpectateEvents(
      [
        event({ name: "Older this year", date: "2026-03-05T06:00:00Z" }),
        event({ name: "Just finished", date: "2026-10-21T05:00:00Z" }),
        event({ name: "Next month", date: "2026-11-01T05:00:00Z" }),
      ],
      NOW,
    );
    assert.deepEqual(past.map((e) => e.name), ["Just finished", "Older this year"]);
    assert.deepEqual(upcoming.map((e) => e.name), ["Next month"]);
  });

  it("leaves out finished events from earlier years", () => {
    const { past, upcoming } = groupSpectateEvents(
      [event({ name: "Last year", date: "2025-11-08T06:00:00Z" })],
      NOW,
    );
    assert.deepEqual(past, []);
    assert.deepEqual(upcoming, []);
  });

  it("keeps a multi-day event in Just past until its last day is over", () => {
    const running = event({
      name: "Three day ride",
      date: "2026-10-28T05:00:00Z",
      days: [
        { id: "d1", date: "2026-10-28", routes: [] },
        { id: "d2", date: "2026-10-29", routes: [] },
        { id: "d3", date: "2026-10-31", routes: [] },
      ] as Event["days"],
    });
    const { past, upcoming } = groupSpectateEvents([running], NOW);
    assert.deepEqual(past, []);
    assert.deepEqual(upcoming.map((e) => e.name), ["Three day ride"]);
  });

  it("hides drafts and private review events from both lists", () => {
    const { past, upcoming } = groupSpectateEvents(
      [
        event({ name: "Draft ride", date: "2026-12-01T05:00:00Z", lifecycle: "draft" }),
        event({ name: "Review ride", date: "2026-12-01T05:00:00Z", isReviewEvent: true }),
      ],
      NOW,
    );
    assert.deepEqual(past, []);
    assert.deepEqual(upcoming, []);
  });

  it("shows archived events that have finished, but never archived future ones", () => {
    const { past, upcoming } = groupSpectateEvents(
      [
        event({ name: "Done and archived", date: "2026-02-19T12:00:00Z", lifecycle: "archived" }),
        event({ name: "Archived but later", date: "2026-12-13T06:00:00Z", lifecycle: "archived" }),
      ],
      NOW,
    );
    assert.deepEqual(past.map((e) => e.name), ["Done and archived"]);
    assert.deepEqual(upcoming, []);
  });
});

describe("event type icons", () => {
  it("labels each event type with its own icon", () => {
    const cases: [string, string, string][] = [
      ["Motorcycle Charity Ride", "Ride For Change 2026", "Motorbike event"],
      ["Enduro", "JBFE Sea to Sea North 2026", "Motorbike event"],
      ["Mountain Bike", "Otto1890 Weekend Warrior Lourensford 2026", "Mountain bike event"],
      ["Cycling", "M&G Investments Tour de Addo 2026", "Cycling event"],
      ["Road Run", "Sabrina Love Summer Challenge 2026: Discovery Vitality Run", "Road run"],
      ["Trail Run", "Sabrina Love Summer Challenge 2026: Trail Run", "Trail run"],
      ["Beach Walk & Surf Ski", "Sabrina Love Summer Challenge 2026: Beach Walk", "Beach & surf event"],
      ["Urban Adventures", "Inner City Enduro 2026", "Urban adventure"],
      ["Stage Racing Event", "M&G Investments PE PLETT 2027", "Stage race"],
    ];
    for (const [discipline, name, label] of cases) {
      assert.equal(getEventTypeIcon(discipline, name).label, label, `${discipline} -> ${label}`);
    }
  });

  it("picks the motorbike icon for a moto event filed under a generic discipline", () => {
    assert.equal(getEventTypeIcon("Cycling", "Rallye Raid Hogsback 2026").label, "Motorbike event");
  });
});
