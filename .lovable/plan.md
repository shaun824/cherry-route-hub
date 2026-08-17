# Sending WhatsApp to riders from the app

Most of the plumbing is already built: the app can already send WhatsApp text, receive inbound messages into Admin → Messages, and there's an "Also send on WhatsApp" tick box on the notifications screen. It's dormant because Meta credentials aren't connected, and because bulk sends to people who haven't messaged you first need approved message templates — which the app doesn't handle yet.

## Part A — What you do (no code)

1. In Meta Business Manager, add your WhatsApp Business number to the **WhatsApp Cloud API** (a number can only live in the app OR the WhatsApp Business phone app, not both — if you want to keep using the phone app, add a second number).
2. Create a permanent access token and note the Phone Number ID.
3. Submit 2–3 message templates for approval (below).
4. Point Meta's webhook at the app's existing endpoint and paste in your verify token.
5. Give me four values to store as secrets: access token, phone number ID, verify token, app secret.

## Part B — What I build

**1. Templates support (the missing piece)**
Meta only lets you send free-form text within 24 hours of a rider messaging you. Everything else — race-day reminders, "you're entered", schedule changes — must use a pre-approved template. I'll add template sending, so the broadcast screen can pick a template and fill its blanks (rider name, event name, time, link).

Suggested templates to submit:
- `event_reminder` — "Hi {{1}}, {{2}} starts {{3}}. Everything you need is in the Rider Hub: {{4}}"
- `event_update` — "{{1}} update: {{2}}. Full details: {{3}}"
- `entry_welcome` — "Hi {{1}}, you're entered for {{2}}. Open the Rider Hub: {{3}}"

**2. Broadcast screen (Admin → Notifications)**
The existing "Also send on WhatsApp" tick box becomes a real WhatsApp section: choose template, preview the exact message, see how many of the selected riders have a usable mobile number, and send. Riders inside the 24-hour window get the plain text version; everyone else gets the template.

**3. Opt-out and consent**
A `whatsapp_opt_out` flag on rider profiles plus a toggle in the rider's notification settings. Anyone who replies STOP is auto-flagged and skipped on all future sends. Required by Meta's policy and stops complaints.

**4. Delivery reporting**
Meta's status callbacks (sent / delivered / read / failed) get recorded against each send, so Admin → Notifications shows real delivery numbers instead of just "queued". Failures show Meta's reason (invalid number, no template, out of window).

**5. Replies**
Already works once credentials are in: rider WhatsApps land as threads in Admin → Messages and your typed reply goes back over WhatsApp. I'll add a visible "24-hour window closes in Xh" marker on each thread so you know when a free-form reply will bounce.

**6. Readiness panel**
A card in Admin → Settings showing whether WhatsApp is connected, which templates are approved, and the webhook status — so it's obvious when something needs attention.

## Notes on cost and rules

Meta charges per conversation (service conversations started by the rider are currently free; marketing/utility ones you start are billed). Bulk marketing sends to people who never opted in risk the number being rate-limited or blocked — I'll keep opt-out enforced everywhere and default broadcasts to utility-style messaging.

## Technical detail

- `src/lib/whatsapp.server.ts`: add `sendWhatsAppTemplate(to, name, lang, components)` alongside the existing text sender; add a `waWindowOpen(threadId)` helper.
- `src/lib/notifications.server.ts`: replace the current text-only WhatsApp branch with template-vs-freeform selection, opt-out filtering, and per-recipient delivery rows.
- `src/routes/api/public/hooks/whatsapp.ts`: handle `statuses[]` in the payload → update `notification_deliveries`; handle STOP/START keywords → set opt-out.
- Migration: `whatsapp_opt_out` boolean on `notification_preferences`, `wa_message_id` + `wa_status` on `notification_deliveries`, and a `whatsapp_templates` table (name, language, body preview, variable map, approved flag).
- `src/routes/admin.notifications.tsx`: WhatsApp panel with template picker, variable mapping, recipient count with numbers, and preview.
- `src/routes/admin.settings.tsx`: readiness card reading a new `whatsappStatus` server function (credentials present, template list from Graph API, webhook subscribed).
- Secrets needed: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.
