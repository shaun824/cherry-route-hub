# Feed the assistant your business knowledge — by email or by paste

Today the assistant learns from three places: the event website crawl, the event database, and FAQ entries approved in Admin → Bot knowledge. This adds a fourth, much richer source: your own written material — rider emails, ops playbooks, product notes, supplier deliverables, policies and standard replies — with a hard wall around anything confidential.

## What you get

**1. A secret forwarding address**

Forward any rider email (or a whole thread) to a private app address. The app:

- reads the email, strips signatures, quoted history and disclaimers,
- redacts personal details (names, phone numbers, ID numbers, email addresses, entry refs) and any money figures tied to sponsorship, contracts or costs,
- works out whether it's a routine question worth learning from,
- drafts a clean question + answer (or a knowledge note) and files it as **Suggested**.

Nothing goes live until you approve it in Admin → Bot knowledge, same as today.

**2. A paste box in the admin**

"Add knowledge" lets you paste an email, a document, meeting notes, a supplier brief or an SOP, tag it (Ops / Product / Suppliers / Policies / General), choose whether it applies to all events or one, and mark it **Public** (rider bot may use it) or **Internal** (admins only). The same redaction and drafting pass runs on paste, and shows you exactly what it removed before saving.

**3. Two knowledge tiers**

- **Public** — the rider assistant can use it, in its own words, for routine questions.
- **Internal** — never reaches a rider answer. Only surfaced when a signed-in admin asks the assistant a question from an admin screen. Used for things like sponsor deliverables with commercial detail, cost structures, contracts, and internal process.

**4. Hard "never say" rules**

Regardless of tier, the assistant is instructed and post-checked so it never states sponsorship values, contract terms, rates, margins, supplier pricing, staff pay, or another rider's personal information. If an answer would need one of those, it says it can't share that and offers the team hand-off. Sponsor answers stay on product and deliverables.

**5. A knowledge library**

Admin → Bot knowledge gains a "Library" tab: every stored note with its category, scope, tier, source (emailed / pasted / learned from chat), when it was added, and how often the bot has used it. Edit, retire or delete any entry. Retired entries stop being used immediately.

## Setting up the email side

You get one secret address and a short setup note in the admin. Two ways to use it:

- Simplest: a forwarding rule in your mailbox (Gmail/Outlook) that sends matching mail to the app's intake, via a free relay (Cloudflare Email Routing or Zapier) — one-time setup, then it's automatic.
- Or just forward manually when a good question comes in.

Either way the address is secret-keyed, so only your forwards are accepted.

## Technical notes

Database (one migration, with grants + RLS):

- `business_knowledge` — `id`, `title`, `body`, `summary`, `category` (ops | product | suppliers | policies | general), `event_id` (nullable = all events), `tier` (public | internal), `status` (suggested | approved | retired), `source_kind` (email | paste | chat), `source_ref`, `redaction_notes`, `times_used`, `created_by`, `approved_by/at`, timestamps. RLS: admin-only for all operations; the bot reads it through the service-role path.
- `knowledge_intake` — raw inbound payloads (from, subject, body hash, received_at, status, error) so a failed ingest can be retried and duplicates skipped.

Server work:

- `src/routes/api/public/hooks/knowledge-email.ts` — signed intake endpoint (shared secret header + HMAC of body), parses the forwarded message, dedupes on body hash, queues it.
- `src/lib/knowledge-ingest.server.ts` — cleaning + redaction + drafting pass via the Lovable AI Gateway (Gemini for the cheap clean-up, GPT-class for the drafting), returning `{ useful, tier, category, scope, title, body, redactions[] }`. Redaction is belt-and-braces: regex pass for IDs/phones/emails/currency amounts, then the model instructed to drop anything commercial.
- `src/lib/knowledge.functions.ts` — admin server functions: list, paste-ingest, upsert, set status, delete, retry intake. All role-checked like `faq-learned.functions.ts`.
- `src/lib/app-bot.server.ts` and `src/lib/event-bot.functions.ts` — pull approved public knowledge (global + focus event) into the context block, ranked by keyword overlap and capped in size; internal-tier rows only added when the caller is a verified admin. Prompt gains the explicit non-disclosure rules and the confidentiality refusal line.
- A nightly job alongside the existing FAQ cron re-checks the library for entries past their review date and flags stale ones.

UI:

- `src/routes/admin.knowledge.tsx` gains "Library" and "Add knowledge" (paste) alongside the current Suggested / Approved / Gaps tabs, with tier and category filters and an "Email intake" panel showing the forwarding address, setup steps and recent intake activity.
