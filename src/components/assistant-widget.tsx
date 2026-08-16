// Global "Ask Red Cherry" assistant. Replaces the old report-an-issue widget:
// riders can ask anything about the app or any event, and the report-a-problem
// form is still available inside the same panel as a fallback.
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { WhatsappButton } from "@/components/whatsapp-button";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Bot, Check, Loader2, MessageSquareWarning, Send, Sparkles, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitFeedback } from "@/lib/feedback.functions";
import { askAppBot } from "@/lib/app-bot.functions";
import { useSession } from "@/lib/auth";

const categories = [
  { value: "issue", label: "Something's broken" },
  { value: "question", label: "Question" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Other" },
] as const;

const STARTERS = [
  "When is my next event?",
  "Where do I find my tent?",
  "How do I link my entry?",
  "What should I pack?",
];

const GREETING =
  "Hi 👋 I'm the Red Cherry assistant. Ask me anything about using the app, or about any of our events — schedules, routes, venues, kit lists, your entry, your tent.";

type ChatMsg = { role: "user" | "assistant"; content: string };

export function AssistantWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const ask = useServerFn(askAppBot);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [showReport, setShowReport] = useState(false);
  // WhatsApp is a last resort: only surfaced once the bot genuinely can't help.
  const [escalated, setEscalated] = useState(false);


  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Deliberately do NOT autofocus the input on open: on iOS that pops the
  // keyboard immediately and hides the greeting/starter questions.


  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  async function sendQuestion(qRaw: string) {
    const q = qRaw.trim();
    if (!q || thinking) return;
    const history = messages.slice(-8);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setThinking(true);
    try {
      const res = await ask({ data: { question: q, history } });
      setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
      if (res.needsAdmin) {
        setShowReport(true);
        setEscalated(true);
      }
    } catch (e) {
      console.error("assistant failed", e);
      setEscalated(true);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Sorry — I couldn't answer that just now. Please try again, or use *Report a problem* below.",
        },
      ]);

    } finally {
      setThinking(false);
      // Only return focus when the rider was already typing (desktop); never
      // force the keyboard open on touch devices.
      const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
      if (!touch) inputRef.current?.focus();
    }

  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Rider" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask Red Cherry — app and event assistant"
        className="fixed right-3 z-40 grid h-12 w-12 place-items-center rounded-full bg-ink text-white shadow-lg ring-1 ring-black/10 transition hover:scale-105 md:right-6 md:bottom-6"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
      >
        <Bot className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 p-4 md:p-6">
          <div
            className="flex w-full min-w-0 flex-col overflow-hidden rounded-3xl bg-card shadow-xl"
            style={{
              width: "min(90vw, 28rem)",
              maxWidth: "min(90vw, 28rem)",
              height: "min(80dvh, 640px)",
              maxHeight: "80dvh",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >


            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-cherry text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold">Ask Red Cherry</h2>
                  <p className="text-[11px] text-ink-soft">App help &amp; event questions</p>
                </div>
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

            <div ref={listRef} className="min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4">
              <div className="max-w-[85%] rounded-2xl bg-secondary px-3 py-2 text-sm text-ink">
                {GREETING}
              </div>

              {messages.length === 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void sendQuestion(s)}
                      className="max-w-full truncate rounded-full bg-background px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-border hover:text-cherry"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}

              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{ overflowWrap: "anywhere" }}
                  className={
                    m.role === "user"
                      ? "ml-auto w-fit max-w-[85%] min-w-0 break-words rounded-2xl bg-cherry px-3 py-2 text-sm text-white"
                      : "w-fit max-w-[85%] min-w-0 break-words rounded-2xl bg-secondary px-3 py-2 text-sm text-ink"
                  }
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-line">{m.content}</p>
                  ) : (
                    <div className="min-w-0 space-y-2 [&_a]:font-semibold [&_a]:break-words [&_a]:text-cherry [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_pre]:overflow-x-auto [&_strong]:font-bold [&_table]:block [&_table]:overflow-x-auto">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => {
                            const to = typeof href === "string" ? href : "";
                            if (to.startsWith("/")) {
                              return (
                                <Link
                                  to={to as any}
                                  onClick={() => setOpen(false)}
                                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-cherry px-3 py-1 text-xs font-semibold !text-white !no-underline"
                                >
                                  <span className="truncate">{children}</span>
                                  <ArrowRight className="h-3 w-3 shrink-0" />
                                </Link>
                              );
                            }
                            return (
                              <a href={to} target="_blank" rel="noreferrer noopener">
                                {children}
                              </a>
                            );
                          },
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>

                  )}
                </div>
              ))}


              {thinking ? (
                <div className="flex max-w-[60%] items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm text-ink-soft">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              ) : null}

              {!user ? (
                <p className="pt-1 text-center text-[11px] text-ink-soft">
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="font-bold text-cherry underline underline-offset-2"
                  >
                    Sign in
                  </Link>{" "}
                  to ask about your own entry, tent or balance.
                </p>
              ) : null}

            </div>

            <div className="min-w-0 max-h-[62%] shrink-0 overflow-y-auto overflow-x-hidden border-t border-border p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendQuestion(input);
                }}
                className="flex min-w-0 items-center gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question…"
                  className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cherry/40"
                />
                <button
                  type="submit"
                  disabled={thinking || !input.trim()}
                  aria-label="Send"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cherry text-white disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowReport((v) => !v)}
                  className="inline-flex min-w-0 items-center gap-1 text-[11px] font-semibold text-ink-soft hover:text-cherry"
                >
                  <MessageSquareWarning className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {showReport ? "Hide report form" : "Report a problem instead"}
                  </span>
                </button>
                {escalated ? (
                  <div className="shrink-0">
                    <WhatsappButton context="the Rider Hub app" size="sm" />
                  </div>
                ) : null}

              </div>


              {showReport ? (
                <ReportForm
                  pathname={pathname}
                  defaultEmail={user?.email ?? ""}
                  transcript={transcript}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ReportForm({
  pathname,
  defaultEmail,
  transcript,
}: {
  pathname: string;
  defaultEmail: string;
  transcript: string;
}) {
  const send = useServerFn(submitFeedback);
  const [category, setCategory] = useState<(typeof categories)[number]["value"]>("issue");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError("Please add a little more detail.");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const body = transcript
        ? `${message.trim()}\n\n--- assistant conversation ---\n${transcript}`.slice(0, 4000)
        : message.trim();
      await send({
        data: {
          message: body,
          category,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          page_path: pathname,
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : undefined,
        },
      });
      setStatus("done");
      setMessage("");
    } catch {
      setStatus("error");
      setError("Couldn't send that. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-secondary px-3 py-3 text-sm">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-cherry text-white">
          <Check className="h-4 w-4" />
        </span>
        <span className="font-semibold">Thanks — the Red Cherry team has it.</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={
              category === c.value
                ? "rounded-full bg-cherry px-2.5 py-1 text-[11px] font-bold text-white"
                : "rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-ink-soft"
            }
          >
            {c.label}
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Tell us what happened…"
        className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cherry/40"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cherry/40"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email to reply to"
          className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cherry/40"
        />
      </div>
      {error ? <p className="text-xs font-semibold text-cherry">{error}</p> : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-cherry px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Send to Red Cherry
      </button>
      <p className="text-center text-[11px] text-ink-soft">Sent from {pathname}</p>
    </form>
  );
}
