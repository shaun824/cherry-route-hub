import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageSquareWarning, X, Check, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitFeedback } from "@/lib/feedback.functions";
import { useSession } from "@/lib/auth";

const categories = [
  { value: "issue", label: "Something's broken" },
  { value: "question", label: "Question" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Other" },
] as const;

export function FeedbackWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const send = useServerFn(submitFeedback);

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof categories)[number]["value"]>("issue");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user?.email && !email) setEmail(user.email);
  }, [open, user?.email, email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError("Please add a little more detail.");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      await send({
        data: {
          message: message.trim(),
          category,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          page_path: pathname,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : undefined,
        },
      });
      setStatus("done");
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1800);
    } catch {
      setStatus("error");
      setError("Couldn't send that. Please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report an issue or send feedback"
        className="fixed right-3 z-40 grid h-12 w-12 place-items-center rounded-full bg-ink text-white shadow-lg ring-1 ring-black/10 transition hover:scale-105 md:right-6 md:bottom-6"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
      >
        <MessageSquareWarning className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl md:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Report an issue</h2>
                <p className="text-xs text-ink-soft">Goes straight to the Red Cherry team.</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {status === "done" ? (
              <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-cherry text-white">
                  <Check className="h-6 w-6" />
                </span>
                <p className="text-sm font-bold">Thanks — we've got it.</p>
                <p className="text-xs text-ink-soft">Our team will take a look.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={
                        category === c.value
                          ? "rounded-full bg-cherry px-3 py-1.5 text-xs font-bold text-white"
                          : "rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-ink-soft"
                      }
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Tell us what happened…"
                  className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cherry/40"
                />

                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cherry/40"
                  />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="Email to reply to"
                    className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cherry/40"
                  />
                </div>

                {error ? <p className="text-xs font-semibold text-cherry">{error}</p> : null}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-cherry px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send feedback
                </button>
                <p className="text-center text-[11px] text-ink-soft">
                  Sent from {pathname}
                </p>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
