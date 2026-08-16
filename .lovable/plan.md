# Replace "Report an issue" with an app-wide Red Cherry assistant

Turn the floating widget on every page from a feedback form into a chat bot that answers questions about how to use the app and about any Red Cherry event (current and future), with the feedback/report path kept as a fallback inside the same panel.

## What the user gets

- Tap the floating button anywhere in the app → a chat panel opens with a short greeting and a few starter suggestions ("Where do I find my tent?", "When is Tour de Addo?", "How do I link my entry?").
- Ask anything in free text. The bot answers from:
  - a written "how to use the app" guide (navigation, linking your entry by ID, village map, offline pack, notifications, promos, crew login),
  - every published/upcoming event in the database (dates, location, schedule, classes, routes, venue, parking, rules, FAQs, packing list, emergency contacts, merch, social/entry links),
  - the crawled event website knowledge already stored per event,
  - admin-approved learned FAQs,
  - and, when the person is signed in, their own records (entry, category, balance, tent/room, race number) — same personal context the event bot already uses.
- Answers render as markdown, with a link straight to the relevant page in the app when there is one.
- If the bot can't answer, it offers two buttons: "Send this to the Red Cherry team" (saves the existing feedback record + email, prefilled with the conversation) and the existing WhatsApp button.
- Signed-out visitors can use it too; personal questions get a "sign in to see your own entry" nudge instead of an answer.

## Technical notes

New server function `askAppBot` in `src/lib/app-bot.functions.ts` (public, no auth middleware; reads the caller's session optionally so personal context works when signed in):

- Loads published events (excluding archived) with `event_info_blocks`, `event_merch_options`, plus per-event crawled knowledge from `event_bot_knowledge` — trimmed to a size-capped context. Full detail is included for the event the user names or is entered in; other events are summarised to name/date/location/status.
- Adds a static app-help section from a new `src/lib/app-help.ts` (plain text describing the app's screens and how-tos), so "how do I…" questions are answerable.
- Adds approved rows from `event_faq_learned` (global + matched event) and, for signed-in users, `buildRiderContext` from `src/lib/event-bot-rider.server.ts`.
- Calls the Lovable AI Gateway chat completions endpoint with `google/gemini-3.6-flash` (fast, cheap, good enough for retrieval-style Q&A over supplied context), same source-priority prompt rules as the event bot, and the same `NEEDS_ADMIN` miss sentinel from `src/lib/bot-handoff.ts`.
- Conversation history is kept client-side in component state for the session (no new table); the full turn list is resent on each call.
- Every question and answer is logged for admin review by reusing `admin_qa_threads` / `admin_qa_messages` when the user is signed in and the question is about a specific event, so the existing Admin → Rider messages and "Save as FAQ" flow keeps working. General app-help questions from signed-out visitors are not persisted.

UI changes:

- `src/components/feedback-widget.tsx` becomes `src/components/assistant-widget.tsx`: same floating button (icon changes to a chat bubble, label "Ask Red Cherry"), sheet contains a scrolling message list, composer, starter chips, and a collapsed "Report a problem instead" section that renders the current feedback form unchanged.
- Messages render with `react-markdown` (already used in the app for chat/feed bodies; added if missing).
- Mounted in the same two places as today: `src/routes/__root.tsx` and `src/components/app-shell.tsx`.
- Existing `submitFeedback` server function and the `feedback` table are untouched.

Nothing changes for the per-event bot on the event page — this is a second, global entry point sharing the same knowledge sources.
