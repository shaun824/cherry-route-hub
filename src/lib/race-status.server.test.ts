import { afterAll, beforeEach, expect, mock, setSystemTime, test } from "bun:test";

const event = { myriad_race_id: "race-1" };
const roster = [{ bib_number: "753", category: "Silver", entrants: { full_name: "Rider One" } }];
const sets = [
  { id: "day1", label: "Day 1 Silver", start_time: "10/31/2026 08:00" },
  { id: "day2", label: "Day 2 Silver", start_time: "11/01/2026 08:00" },
  { id: "day2gold", label: "Day 2 Gold", start_time: "11/01/2026 08:15" },
  { id: "day3", label: "Day 3 Silver", start_time: "11/02/2026 08:00" },
];
let rows = [{ full_name: "Rider One", bib_number: "753", category: "Silver", time_text: "02:00:00", time_ms: 7200000, result_set_id: "day1" }];
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: event }),
    limit: async () => ({ data: table === "event_entrants" ? roster : [] }),
  }) }) }) },
}));
mock.module("@/lib/myriad.server", () => ({ fetchRaceResults: async () => ({ rows, sets }) }));
const { buildRaceStatus } = await import("./race-status.server");

beforeEach(() => { setSystemTime(new Date("2026-11-01T10:00:00Z")); });
afterAll(() => { setSystemTime(); mock.restore(); });

test("Day 2 default keeps a Day 1 finisher still out", async () => {
  const result = await buildRaceStatus("event", null);
  expect(result.dayKey).toBe("2026-11-01");
  expect(result.finished).toHaveLength(0);
  expect(result.stillOut.map((r) => r.bib)).toEqual(["753"]);
});
test("All routes counts only current-day finishes", async () => {
  const result = await buildRaceStatus("event", "all");
  expect(result.dayKey).toBe("all");
  expect(result.finished).toHaveLength(0);
  expect(result.stillOut.map((r) => r.bib)).toEqual(["753"]);
});
test("explicit Day 1 keeps its own finished result", async () => {
  const result = await buildRaceStatus("event", "2026-10-31");
  expect(result.finished.map((r) => r.bib)).toEqual(["753"]);
  expect(result.stillOut).toHaveLength(0);
});
test("Day 3 does not reuse Day 1 finishes", async () => {
  setSystemTime(new Date("2026-11-02T10:00:00Z"));
  const result = await buildRaceStatus("event", "all");
  expect(result.finished).toHaveLength(0);
  expect(result.stillOut).toHaveLength(1);
});
test("a current-day result clears still out and uses its finish time", async () => {
  rows = [...rows, { ...rows[0], result_set_id: "day2", time_text: "03:00:00", time_ms: 10800000 }];
  const result = await buildRaceStatus("event", "all");
  expect(result.finished).toHaveLength(1);
  expect(result.finished[0].finishedAt).toBe("2026-11-01T09:00:00.000Z");
  expect(result.stillOut).toHaveLength(0);
});