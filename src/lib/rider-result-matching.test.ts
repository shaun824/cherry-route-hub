import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { resultsForRider, timingBibForRider } from "./rider-result-matching";
import type { ResultRow } from "./results.functions";

const row = (name: string, bib: string, time = "1:42:15"): ResultRow => ({
  id: bib, result_set_id: "day1", full_name: name, bib_number: bib,
  category: "Gold", batch: null, position: 12, time_text: time, time_ms: 6135000,
  gap_text: null, status: null, extras: {},
});
describe("live rider identity", () => {
  test("missing entry bib still finds Natalie Stacey's timing result", () => {
    const rider = { full_name: "Natalie Stacey", bib_number: null };
    const rows = [row("Natalie Stacey", "235")];
    assert.equal(resultsForRider(rider, rows)[0]?.time_text, "1:42:15");
    assert.equal(timingBibForRider(rider, rows), "235");
  });
  test("same-name riders with different numbers are not merged", () => {
    assert.deepEqual(resultsForRider({ full_name: "Natalie Stacey", bib_number: null }, [row("Natalie Stacey", "235"), row("Natalie Stacey", "236")]), []);
  });
  test("known number wins over another rider with the same name", () => {
    assert.equal(resultsForRider({ full_name: "Natalie Stacey", bib_number: "235" }, [row("Natalie Stacey", "235"), row("Natalie Stacey", "236")]).length, 1);
  });
  test("case, whitespace and accents do not hide a result", () => {
    assert.equal(resultsForRider({ full_name: "Loïc  Raemaekers", bib_number: null }, [row("LOIC RAEMAEKERS", "14")]).length, 1);
  });
});