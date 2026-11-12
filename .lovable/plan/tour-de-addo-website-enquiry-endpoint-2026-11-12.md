# Tour de Addo website enquiry endpoint

## What it does
The contact form on tourdeaddo.com posts straight to Rider Hub. Each real enquiry is saved, the team gets an email, the rider gets an instant branded reply, and riders who tick the news box are added to Everlytic.

## Answers to your questions

**Everlytic lists** (found in your Everlytic account, read-only check)
- `102527` "Enquiry -  TDA": the Tour de Addo enquiry list
- `102600` "Bicycles": the master Bicycles list the app already uses for Otto1890 Weekend Warrior
- Note: a second list called "Bicycles" (`101260`) also exists. I'd use `102600` so everything stays on one list. Say if `101260` is the real master.
- The IDs are stored in a setting named `TDA_ENQUIRY_EVERLYTIC_LIST_IDS` = `102527,102600`, so you can change them without a code change.

**Email sending**
- Both emails use the app's existing email setup (Lovable's built-in sending). They come from the verified sender `noreply@notify.riderapp.redcherryevents.co.za`, the same as the other app emails.
- The team notification uses Reply-To set to the rider's email, so hitting Reply goes to the rider. The rider's auto-reply uses Reply-To `team@redcherryevents.co.za`.
- Both are one-off emails for one person, so they count as app emails, not marketing. Lovable adds its unsubscribe footer to every app email, and this can't be turned off. Both emails stay free of promo content. The 2027 trip facts and the Book button are treated as an answer to the rider's question.

**Public URL once published**
- `https://riderhub.redcherryevents.co.za/api/public/tda-enquiry`
- Fallback that never changes: `https://cherry-route-hub.lovable.app/api/public/tda-enquiry`

**Effects on the live app and production database**
- Preview and the live app share one database, so the new table is created in production straight away. It is additive only. No existing table changes.
- The endpoint only starts working after publishing. Until the website points to it, nothing changes.
- Each enquiry uses two app emails, which count toward the hourly email allowance shared with other app emails.
- Testing makes one test enquiry, emails it to team@ and to a test address, then deletes only that test row. If you don't want a test email to team@, say so.

## Steps
1. **Database:** new table `website_enquiries` with `event_key` (default 'tour-de-addo'), name, email (lowercased), phone, trip, message, consent, consent_at, everlytic_synced, everlytic_error, notified, auto_replied and created_at. Only admins can read or update it, and visitors can never read it. Inserts come from the endpoint on the server.
2. **Endpoint** `POST /api/public/tda-enquiry`:
   - CORS allows only tourdeaddo.com, www.tourdeaddo.com and tour-de-addo.vercel.app, with OPTIONS preflight. Other origins are refused.
   - Reads multipart form data (or JSON) and checks it: name, email and message required, with length limits. Trip must be one of the 4 values. Consent is "on" or blank. `_subject` is ignored.
   - A filled-in `_gotcha` field returns 200 and does nothing.
   - Rate limits use the existing durable counter: about 20 a minute overall and 5 an hour per email. Over the limit returns 429 with a clear message.
   - Valid enquiries are saved and return `{ok:true}`. Validation errors return 400 with a message like "Please add your email address."
   - Emails and Everlytic run after the save. Their failures are recorded on the row and never fail the response.
3. **Everlytic, only with consent:** reuses the existing opt-out-safe helper. It adds the contact to both lists only where they are missing, and never changes existing memberships or opt-outs. Without consent, nothing goes to Everlytic.
4. **Team email** to team@redcherryevents.co.za
   - Subject: "Tour de Addo enquiry: {trip} · {name}". This uses "·" instead of a long dash, following your no-long-dash rule.
   - Shows every field plus consent yes/no.
   - Each email is only ever sent once per enquiry.
5. **Rider auto-reply** with M&G Investments Tour de Addo branding:
   - Thanks them and repeats their question back.
   - Says the team will reply within 2 working days.
   - Lists the 2027 trips: Darlington Dam 22-25 Apr and 26-29 Apr 2027, Nyati 18-21 Aug 2027.
   - Says each tour takes 30 riders and a R5 000 deposit secures a spot.
   - Has a "Book 2027" button to https://tourdeaddo.com/#book and the phone number (041) 581 5335.
   - Written plainly, with no long dashes. Each email is only ever sent once per enquiry.
6. **Admin list:** a new "Website enquiries" page in Admin shows the newest first. It has an "Unsynced to Everlytic" filter, a retry-sync button for opted-in rows, and a CSV export.
7. **Tests:** cover field validation, the honeypot, the CORS allow-list and the consent rule (no consent means no Everlytic). Then one end-to-end test submission, followed by deleting that test row.

## Website side (for whoever edits the Astro site)
- Point the form's fetch to the URL above. Keep `Accept: application/json`.
- Add the consent checkbox with name `consent`.
- No secret is needed.

## Technical details
- Route: `src/routes/api/public/tda-enquiry.ts`, with logic in `src/lib/tda-enquiry.server.ts` and the shared schema in `src/lib/tda-enquiry.ts`.
- Rate limits use `consume_request_quota`, keyed by a hashed email or a global scope, and never by the client IP the caller supplies.
- Templates: `tda-enquiry-notification.tsx` and `tda-enquiry-auto-reply.tsx`, registered in the registry. Idempotency keys are `tda-enquiry-notify-{id}` and `tda-enquiry-reply-{id}`.
- RLS uses `has_role(auth.uid(),'admin')` for select and update. Grants go to authenticated and service_role only, with nothing for anon.
- The everlytic_synced and notified flags are updated after each step.
