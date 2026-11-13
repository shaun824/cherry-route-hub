import { afterAll, expect, mock, test } from "bun:test";
import { eventInterestTemplate } from "./event-interest";
import { ICE_EVENT_ID } from "./ice-interest";

test("ICE keeps its branded confirmation while other events use the shared template", () => {
  expect(eventInterestTemplate(ICE_EVENT_ID)).toBe("ice-signup-confirmation");
  expect(eventInterestTemplate("2544f097-ba01-416a-8f51-dbd8af33f5de")).toBe("event-interest-confirmation");
});

let signup = { id: "signup-1", unsubscribed_at: "2026-10-31T10:00:00Z" };
const confirmationKeys = [];
const originalKey = process.env.EVENT_INTEREST_KEY;
process.env.EVENT_INTEREST_KEY = "test-only-event-interest";
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table) => {
    if (table === "events") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "f046ce38-e687-4038-959d-271ba20825f0", name: "Inner City Enduro 2026", slug: null, lifecycle: "published", everlytic_interest_list_id: null } }) }) }) };
    return {
      select: () => ({ gte: async () => ({ count: 0 }), eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...signup } }) }) }) }),
      update: (patch) => ({ eq: async () => { signup = { ...signup, ...patch }; return { error: null }; } }),
    };
  } },
}));
mock.module("@/lib/email-templates/send-email", () => ({ sendTemplateEmail: async (_template, _email, options) => { confirmationKeys.push(options.idempotencyKey); } }));
const { handleEventInterest } = await import("./event-interest-handler.server");
afterAll(() => {
  if (originalKey === undefined) delete process.env.EVENT_INTEREST_KEY;
  else process.env.EVENT_INTEREST_KEY = originalKey;
  mock.restore();
});
const request = (consent) => new Request("https://example.test/api/public/event-interest", {
  method: "POST", headers: { "content-type": "application/json", "x-event-interest-key": "test-only-event-interest" },
  body: JSON.stringify({ event_id: "f046ce38-e687-4038-959d-271ba20825f0", email: "test@example.test", name: "Test", consent }),
});
test("re-signup clears the unsubscribe and creates a new confirmation through the handler", async () => {
  const response = await handleEventInterest(request(true));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, id: "signup-1" });
  expect(signup.unsubscribed_at).toBeNull();
  expect(signup.consent).toBe(true);
  expect(confirmationKeys).toEqual(["event-interest-confirm-signup-1-rejoin-2026-10-31T10:00:00Z"]);
});
test("ordinary duplicate signup uses the original dedupe key", async () => {
  await handleEventInterest(request(true));
  expect(confirmationKeys[1]).toBe("event-interest-confirm-signup-1");
});
test("missing consent cannot rejoin an unsubscribed record", async () => {
  signup.unsubscribed_at = "2026-11-01T07:22:00Z";
  const response = await handleEventInterest(request(false));
  expect(response.status).toBe(400);
  expect(signup.unsubscribed_at).toBe("2026-11-01T07:22:00Z");
  expect(confirmationKeys).toHaveLength(2);
});