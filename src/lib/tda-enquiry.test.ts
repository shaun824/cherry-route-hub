import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAllowedTdaOrigin, parseTdaEnquiry, shouldSyncToEverlytic, tdaCorsHeaders, tdaListIds } from "./tda-enquiry.ts";

const base = { name: "Sam", email: "Sam@Example.com", message: "Is Nyati OK for a first-timer?", trip: "Best of Nyati 18–21 August 2027" };

describe("Tour de Addo enquiry form", () => {
  it("requires name, email and question", () => {
    for (const k of ["name", "email", "message"]) {
      const r = parseTdaEnquiry({ ...base, [k]: "" });
      assert.equal(r.kind, "invalid");
    }
  });
  it("lowercases the email", () => {
    const r = parseTdaEnquiry(base);
    assert.equal(r.kind === "ok" && r.enquiry.email, "sam@example.com");
  });
  it("rejects a trip that is not on the list", () => {
    assert.equal(parseTdaEnquiry({ ...base, trip: "Mystery tour" }).kind, "invalid");
  });
  it("treats a filled honeypot as done without storing", () => {
    assert.equal(parseTdaEnquiry({ ...base, _gotcha: "bot" }).kind, "honeypot");
  });
  it("only syncs to Everlytic when consent is ticked", () => {
    const yes = parseTdaEnquiry({ ...base, consent: "on" });
    const no = parseTdaEnquiry(base);
    assert.equal(yes.kind === "ok" && shouldSyncToEverlytic(yes.enquiry), true);
    assert.equal(no.kind === "ok" && shouldSyncToEverlytic(no.enquiry), false);
  });
  it("allows only the three Tour de Addo sites", () => {
    assert.equal(isAllowedTdaOrigin("https://tourdeaddo.com"), true);
    assert.equal(isAllowedTdaOrigin("https://www.tourdeaddo.com"), true);
    assert.equal(isAllowedTdaOrigin("https://tour-de-addo.vercel.app"), true);
    assert.equal(isAllowedTdaOrigin("https://evil.example"), false);
    assert.equal(tdaCorsHeaders("https://evil.example")["Access-Control-Allow-Origin"], undefined);
  });
  it("uses the Enquiry TDA and Bicycles lists by default", () => {
    assert.deepEqual(tdaListIds(undefined), ["102527", "102600"]);
  });
});
