import { describe, expect, it } from "vitest";

import { mergeAudiences, normaliseEmail } from "./event-interest";

const entrants = [
  { email: "Rider@Example.com", name: "Rider One" },
  { email: "two@example.com", name: "Rider Two" },
];
const interest = [
  { email: "rider@example.com", name: "Rider Interest", interestId: "i1" },
  { email: "three@example.com", name: "Rider Three", interestId: "i3" },
];

describe("mergeAudiences", () => {
  it("entrants audience ignores interest sign-ups", () => {
    const out = mergeAudiences(entrants, interest, "entrants");
    expect(out.map((p) => p.email).sort()).toEqual(["rider@example.com", "two@example.com"]);
  });

  it("interest audience ignores entrants", () => {
    const out = mergeAudiences(entrants, interest, "interest");
    expect(out.map((p) => p.email).sort()).toEqual(["rider@example.com", "three@example.com"]);
    expect(out.find((p) => p.email === "three@example.com")?.interestId).toBe("i3");
  });

  it("both dedupes by email and the entrant record wins", () => {
    const out = mergeAudiences(entrants, interest, "both");
    expect(out).toHaveLength(3);
    const shared = out.find((p) => p.email === "rider@example.com");
    expect(shared?.name).toBe("Rider One");
    expect(shared?.interestId).toBeUndefined();
  });

  it("normalises case and whitespace", () => {
    expect(normaliseEmail("  Person@Example.COM ")).toBe("person@example.com");
  });
});
