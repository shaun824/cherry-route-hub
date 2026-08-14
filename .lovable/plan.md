# Connecting WhatsApp Business to the Rider Hub chat

WhatsApp threads cannot be rendered inside a third-party chat UI — Meta does not allow it. So the app cannot literally "show" WhatsApp conversations. What it can do is bridge messages both ways so riders use WhatsApp while your team keeps one inbox.

Recommended: ship the quick win now, then the bridge.

## Phase 1 — WhatsApp button (works today, no Meta approval)

- Add a "Chat on WhatsApp" action next to the existing "Ask admin" panel on the event page and in the footer.
- The link opens WhatsApp with a prefilled message containing the event name and the rider's name/registration ref, so your team knows who is writing.
- Support number stored in site settings so you can change it without a code change.

Trade-off: the conversation lives only in WhatsApp; nothing is saved in the app.

## Phase 2 — Two-way bridge into the admin inbox

Riders message your WhatsApp Business number; those messages appear in `/admin/messages` alongside in-app threads, and admin replies are delivered back over WhatsApp.

Flow:

```text
Rider (WhatsApp) -> Meta Cloud API -> /api/public/hooks/whatsapp -> admin_qa_threads/messages
Admin reply in /admin/messages -> server function -> Meta Cloud API -> Rider (WhatsApp)
```

What gets built:
- A public webhook route that verifies Meta's signature, handles the verify-token handshake, and stores inbound messages.
- Thread matching: link the sender's phone number to a rider profile (phone from Entry Ninja sync); unmatched numbers get an "unknown sender" thread the admin can attach to a rider.
- A channel marker on threads so the admin inbox shows a WhatsApp badge and routes replies outbound instead of in-app.
- Outbound send with error surfacing (Meta returns detailed error bodies).

What you must provide:
- A Meta Business account with WhatsApp Business Platform (Cloud API) enabled and a registered number — the phone WhatsApp Business app alone is not enough, and a number can only live in one of the two.
- Phone number ID, business account ID, a permanent access token, and a webhook verify token (stored as secrets).

Constraints to know upfront:
- 24-hour window: you can freely reply within 24h of a rider's last message. Outside it, only pre-approved message templates can be sent (Meta approval, per-message cost).
- Numbers, not accounts: matching relies on the rider's phone number being on file.

## Phase 3 (optional) — WhatsApp notifications

When an admin replies in the app, send an approved template alert to the rider's WhatsApp so they come back to the app. Requires template approval.

## Technical notes

- Webhook: `src/routes/api/public/hooks/whatsapp.ts` with GET (verify handshake) and POST (HMAC-SHA256 signature check against the raw body, Zod-validated payload).
- Storage: reuse `admin_qa_threads` / `admin_qa_messages`; add `channel` ('app' | 'whatsapp') and `wa_phone` columns plus an index on phone.
- Outbound: server function calling `graph.facebook.com/v21.0/{phone_number_id}/messages`, invoked from the existing admin reply handler when the thread channel is WhatsApp.
- Secrets: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.
- Realtime already refreshes the admin inbox, so inbound WhatsApp messages appear without a reload.

## Suggested start

Approve Phase 1 alone if you want something live today; approve Phases 1 + 2 if you can get the Cloud API number set up.
