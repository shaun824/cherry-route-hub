import { createServerFn } from "@tanstack/react-start";
import { eventInterestSignupSchema } from "./event-interest-signup";

export const subscribeToEventInterest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => eventInterestSignupSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true };
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      throw new Error("Please use the event page to sign up.");
    }
    const key = process.env["EVENT_INTEREST_KEY"];
    if (!key) throw new Error("Sign-ups are temporarily unavailable. Please try again later.");
    const { handleEventInterest } = await import("./event-interest-handler.server");
    const response = await handleEventInterest(new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Event-Interest-Key": key },
      body: JSON.stringify({
        event_id: data.eventId,
        name: data.firstName,
        email: data.email,
        consent: data.consent,
        website: data.website,
        topic: "Entry alerts",
        source: "Rider Hub event page",
      }),
    }));
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) throw new Error(result.error || "Please try again.");
    return { ok: true };
  });
