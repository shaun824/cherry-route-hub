import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { KCA_URL } from "./sabrina-love";
import { DEFAULT_SETTINGS } from "./settings";
import { useAdminStore } from "./store";
import { SlscKcaCard, formatRand } from "@/components/slsc-kca-card";
import { KcaMatchBand } from "@/lib/email-templates/sabrina-love-brand";

const ENTRY_URL = "https://www.entryninja.com/events/83457-walk-surf-ski";

beforeEach(() => {
  useAdminStore.setState({ settings: DEFAULT_SETTINGS });
});

describe("Sabrina Love approved KCA campaign", () => {
  it("points at keepachildalive.org on the card and in email", () => {
    assert.equal(KCA_URL, "https://www.keepachildalive.org");
    const card = renderToStaticMarkup(<SlscKcaCard entryUrl={ENTRY_URL} />);
    const email = renderToStaticMarkup(<KcaMatchBand entryUrl={ENTRY_URL} />);
    assert.match(card, /href="https:\/\/www\.keepachildalive\.org"/);
    assert.match(email, /href="https:\/\/www\.keepachildalive\.org"/);
  });

  it("uses the approved every entry and every donation wording", () => {
    const card = renderToStaticMarkup(<SlscKcaCard entryUrl={ENTRY_URL} />);
    const email = renderToStaticMarkup(<KcaMatchBand entryUrl={ENTRY_URL} />);
    assert.match(card, /every Summer Challenge entry and every donation, rand for rand/);
    assert.match(email, /every Summer Challenge entry and every donation, rand for rand/);
    assert.match(card, /Let&#x27;s raise a million!/);
    assert.doesNotMatch(card, /matching every donation made through the Summer Challenge/);
    assert.doesNotMatch(email, /matching every donation made through the Summer Challenge/);
  });

  it("links the primary button to the event's own Entry Ninja page", () => {
    const html = renderToStaticMarkup(<SlscKcaCard entryUrl={ENTRY_URL} />);
    assert.match(html, new RegExp(`href="${ENTRY_URL}"`));
    assert.match(html, /data-track-action="slsc_entry_donation_opened"/);
    assert.match(html, /href="https:\/\/www\.givengain\.com\/cc\/sabrinalove"/);
  });

  it("shows only the R1m goal until an admin enters a real raised figure", () => {
    const html = renderToStaticMarkup(<SlscKcaCard entryUrl={ENTRY_URL} />);
    assert.match(html, /R1,000,000/);
    assert.doesNotMatch(html, /Raised so far/);
    assert.doesNotMatch(html, /role="progressbar"/);
    assert.doesNotMatch(html, /R1,234,567/);
  });

  it("shows the shared raised figure, progress and updated date once supplied", () => {
    useAdminStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        kcaCampaign: { raised: 250000, goal: 1000000, updated: "2026-11-13" },
      },
    });
    const html = renderToStaticMarkup(<SlscKcaCard entryUrl={ENTRY_URL} />);
    assert.match(html, /Raised so far, with KCA&#x27;s match/);
    assert.match(html, /aria-valuenow="250000"/);
    assert.match(html, /aria-valuemax="1000000"/);
    assert.match(html, /width:25%/);
    assert.match(html, /Updated 13 Nov 2026/);
  });

  it("formats the animated Rand total with comma separators", () => {
    assert.equal(formatRand(1234567), "R1,234,567");
  });
});
