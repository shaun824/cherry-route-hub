# Teach the assistant by chatting to it

Give super admins a conversation where they can *tell* the assistant things — typed messages, screenshots, photos of a whiteboard or a printed sheet, voice notes, or a PDF — and have it turn each one into a knowledge note it can answer from immediately. Available both in the admin backend and from the front end on any page.

## How it will feel

1. Open **Teach** (new tab in Admin → Knowledge, and a "Teach me something" mode inside the Ask Red Cherry chat bubble that only super admins see).
2. Send a message. Attach a screenshot, snap a photo, hold to record a voice note, or attach a PDF.
3. The assistant reads/listens, then replies with what it understood:
   > "Got it. **Toilet servicing at Lourensford** — the 10 hired toilets are serviced Saturday 19:00… Tag to Weekend Warrior, crew-only. Save this?"
4. Buttons under the reply: **Save** · **Edit first** · **Discard**. Optional choices for which event it belongs to and whether it's rider-facing or crew-only (it guesses, you can override).
5. On Save it goes live straight away — ask a question in the normal chat and it answers from the new note.
6. Follow-up messages in the same thread refine the last note ("no, it's 400 m away, not next to them") rather than creating a duplicate.

Everything taught this way still passes through the existing redaction (personal details and commercial figures stripped) and lands in the same library, so it can be edited, retired or deleted later under Admin → Knowledge.

## Who can do it

Super admins only — admin role required on the server for every step, so the teach controls simply don't appear for riders or crew.

## Technical notes

- **New server functions** in `src/lib/knowledge-teach.functions.ts`:
  - `teachAssistant` — accepts `{ message, attachment?: { kind: "image" | "audio" | "pdf", mimeType, dataBase64 }, threadNoteId?, eventId?, tier? }`, asserts admin, extracts text, drafts, returns the draft without saving.
  - `saveTaughtNote` — persists the confirmed/edited draft via the existing `ingestKnowledge` path with `status: "approved"`, `source_kind: "chat"` (existing value — no schema change).
- **Extraction** (`src/lib/knowledge-teach.server.ts`), all through Lovable AI Gateway with `LOVABLE_API_KEY`:
  - Image → `image_url` content block on a multimodal chat call; prompt asks for a faithful transcription plus what the screenshot shows.
  - Voice note → `input_audio` block (base64, format derived from the recording's real container: `webm` on Chrome/Android, `m4a` on Safari/iOS) for transcription.
  - PDF → `file` content block with the real MIME type.
  - Extracted text then flows into the existing `ingestKnowledge` drafting + double redaction pass unchanged.
- **Refinement**: when `threadNoteId` is present, the drafting prompt receives the existing note body and returns a merged, corrected version; saving updates that row instead of inserting a new one.
- **No database migration.** `business_knowledge` already has every field needed; `source_kind: "chat"` is already allowed.
- **No file storage bucket.** Attachments are sent inline as base64 and discarded after extraction. Client-side guards: images downscaled to ~1600 px JPEG, voice notes capped at ~3 minutes, PDFs at 8 MB, with a clear message if a file is too big.
- **UI**:
  - `src/components/knowledge-teach-chat.tsx` — the shared teach conversation (message list, attach/camera/mic controls, draft card with Save / Edit / Discard, event + visibility selectors).
  - Mounted as a **Teach** tab in `src/routes/admin.knowledge.tsx`.
  - Mounted inside `src/components/assistant-widget.tsx` behind a small "Teach" toggle rendered only when the signed-in user has the admin role.
- Model choice follows the project default for text/vision reasoning; transcription uses the gateway's speech-to-text model.

## Verification

Teach by text, by screenshot and by voice note; save each; then ask the normal assistant a question that only the new note can answer and confirm it comes back correct — on the admin side and, for a rider-facing note, signed out.
