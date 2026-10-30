import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { KCA_URL } from "./sabrina-love";
import { SlscKcaCard } from "@/components/slsc-kca-card";
import { KcaMatchBand } from "@/lib/email-templates/sabrina-love-brand";

describe("Sabrina Love KCA link", () => {
  it("points at keepachildalive.org", () => {
    assert.equal(KCA_URL, "https://www.keepachildalive.org");
  });

  it("uses that link on the in-app KCA card", () => {
    const html = renderToStaticMarkup(<SlscKcaCard />);
    assert.match(html, /href="https:\/\/www\.keepachildalive\.org"/);
  });

  it("uses that link in the Sabrina Love email KCA band", () => {
    const html = renderToStaticMarkup(<KcaMatchBand entryUrl="https://www.entryninja.com/events/83457-walk-surf-ski" />);
    assert.match(html, /href="https:\/\/www\.keepachildalive\.org"/);
  });
});
