# Chat to WhatsApp when the bot can't help

Most of this is already built — the WhatsApp button, the settings panel and the inbound webhook exist. What's missing is (1) switching it on with your number, (2) making the button appear at the right moment (when the assistant can't answer), and (3) the credentials needed if you want replies to happen inside the app rather than in WhatsApp itself.

## Step 1 — Switch on the button (works today, no Meta setup)

In Admin → Settings there is a **WhatsApp support** card. You enter your WhatsApp Business number, turn it on, and save. A green "Chat on WhatsApp" button then appears in the app footer and on each event's Ask-admin panel. Tapping it opens WhatsApp with a message already typed for you.

Nothing else is required for this — no Meta approval, no developer account. The conversation lives in your WhatsApp Business inbox.

## Step 2 — Make the handoff smart (the part to build)

Right now the button is always visible in the chat header. Change it so it becomes the obvious next step exactly when a rider is stuck:

- When the assistant answers with "I'm not sure" / hands off to an admin, show an inline card under that reply: **"Still stuck? Chat with us on WhatsApp"**.
- Prefill the WhatsApp message with the rider's actual question, their name and the event name, so you get context instead of "hi".
- Add the same button to the feedback widget and the event Info tab, so there's always a human route out.
- Keep the button hidden entirely when WhatsApp support is switched off in settings.

## Step 3 — Optional: replies inside the app instead of WhatsApp

The two-way bridge is already coded (webhook + outbound sending + WhatsApp badges in Admin → Messages). It stays dormant until Meta credentials are added. To activate it you'd need a Meta Business account with WhatsApp Cloud API enabled, then supply four values as secrets:

- `WHATSAPP_TOKEN` (permanent access token)
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN` (any phrase you choose, entered in both places)
- `WHATSAPP_APP_SECRET`

You then point Meta's webhook at the app's existing endpoint. After that, rider WhatsApp messages appear as threads in Admin → Messages and your replies go back out over WhatsApp. Note Meta's rule: you can only reply freely for 24 hours after a rider messages you; after that an approved template is required.

Step 3 is not needed for the handoff to work — it's only about where you answer from.

## Technical notes

- Handoff card lives in `AskAdminPanel` in `src/routes/my-events.$eventId.tsx`, triggered when the latest bot message is flagged as unresolved; reuses `WhatsappButton` with a `context` string built from event name + last rider question.
- `src/components/whatsapp-button.tsx` already reads `support` settings via `fetchSupportSettings` and returns `null` when disabled — no extra guarding needed.
- Add the button to `src/components/feedback-widget.tsx` and the event Info tab.
- Bridge pieces already in place: `src/routes/api/public/hooks/whatsapp.ts`, `src/lib/whatsapp.server.ts`, `src/lib/whatsapp.functions.ts`, plus `channel` / `wa_phone` / `wa_name` on `admin_qa_threads`.
