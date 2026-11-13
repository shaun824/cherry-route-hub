import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscribeToEventInterest } from "@/lib/event-interest-signup.functions";
import { eventInterestSignupSchema } from "@/lib/event-interest-signup";

export function EventInterestSignupCard({ eventId, eventName }: { eventId: string; eventName: string }) {
  const subscribe = useServerFn(subscribeToEventInterest);
  const [state, setState] = useState<"idle" | "sending" | "success">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = eventInterestSignupSchema.safeParse({
      eventId,
      firstName: form.get("firstName"),
      email: form.get("email"),
      consent: form.get("consent") === "on",
      website: form.get("website") || "",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Please check your details.");
      return;
    }
    setError("");
    setState("sending");
    try {
      await subscribe({ data: parsed.data });
      setState("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save your sign-up. Please try again.");
      setState("idle");
    }
  }

  return (
    <section data-section="entry_interest" className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cherry">
        <Mail className="h-3.5 w-3.5" /> Dates to be confirmed
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">Get entry alerts</h2>
      {state === "success" ? (
        <div role="status" className="mt-3 flex items-start gap-3 rounded-xl bg-accent p-3 text-sm text-ink">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cherry" />
          <p>You are on the list for {eventName}. We will email you when dates and entries are confirmed.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <p className="text-xs leading-relaxed text-ink-soft">Entries are not open yet. Join the list and we will email you when the 2027 dates and entries are confirmed.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink">
              First name
              <input name="firstName" required maxLength={80} autoComplete="given-name" className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none focus:border-cherry" />
            </label>
            <label className="text-xs font-semibold text-ink">
              Email address
              <input name="email" type="email" required maxLength={254} autoComplete="email" className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none focus:border-cherry" />
            </label>
          </div>
          <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
            <input name="consent" type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 accent-cherry" />
            <span>Send me {eventName} entry alerts and Red Cherry Events motorbike news. I can unsubscribe at any time.</span>
          </label>
          {error ? <p role="alert" className="text-xs font-semibold text-cherry">{error}</p> : null}
          <Button type="submit" disabled={state === "sending"} className="h-11 w-full rounded-xl cherry-gradient text-sm font-bold text-primary-foreground">
            {state === "sending" ? "Signing you up…" : "Notify me"}<ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}
    </section>
  );
}
