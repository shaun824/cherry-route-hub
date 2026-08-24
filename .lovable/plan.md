# Crew Learn: staff training built from your live event data

A new **Learn** section inside the crew tools (crew login only) that turns everything already in the app — events, schedules, venues, run sheets, departments, packing lists, rooming, rider journey, knowledge base — into structured courses your new employee works through, with progress tracking you can see.

## Three channels

Learn opens on a picker with three tracks:

1. **The business** — how Red Cherry runs events end to end: our events and disciplines, the season calendar, entry flow via Entry Ninja, rider communication (app, WhatsApp, push, feed), loyalty, sponsors and partner promos, tone of voice, confidentiality rules.
2. **This event** — pick an event and get the full picture: dates and day-by-day schedule (registration day rule applied), venues and night-by-night accommodation, village map and rooming, route profiles and water points, categories and batches, merchandise and inclusions, finish location, key contacts, FAQs.
3. **Your department** — the run-sheet departments already synced for that event: what the department does, hour-by-hour tasks per day, packing list, safety notes, lead and contacts, and the waiver.

Each channel is a course. A course is an ordered list of modules; a module is a few short lesson cards with a "why this matters" note, real examples pulled from your data (real venue names, real times, real tent numbers), and a short check-your-understanding quiz (3–5 questions) at the end.

## How it feels for the new employee

1. Signs in at `/crew/login`, taps **Learn** in the crew tabs.
2. Sees a progress ring: "Business 40% · PE PLETT 0% · Registration dept 0%".
3. Works through modules on their phone, ticking lessons off. Progress saves per person and survives reload.
4. Quiz at the end of each module; passing marks the module complete. They can retake.
5. A **Ask the trainer** button on every lesson opens the existing internal-tier assistant pre-loaded with that lesson's context, so they can ask follow-ups ("what happens if a rider arrives after cut-off?").
6. Finishing a course awards a completion record with date.

## What you see as admin

`/admin/learn`:
- Generate/refresh courses per event (one tap; content drafted from live data).
- Edit any module or lesson, add your own lessons, reorder, hide.
- Write extra quiz questions.
- Staff progress table: who has completed what, quiz scores, last active, completion dates.

## Content generation

Courses are drafted server-side from data already in the app, then stored so you can edit them:

- Business course: events table, feed, promos, loyalty settings, business knowledge (internal tier included).
- Event course: `events`, `event_info_blocks`, `event_venues`, `event_village_maps`, `event_merch_options`, schedule, route stats, `event_price_book`.
- Department course: `event_departments`, `run_sheet_tasks`, `department_packing_items`.

The AI turns those into plain-English lessons plus quiz questions; nothing is invented — each lesson stores which records it came from, so a refresh updates the wording when the underlying data changes and flags lessons whose source data moved.

## Technical notes

- New tables: `learn_courses`, `learn_modules`, `learn_lessons`, `learn_quiz_questions`, `learn_progress` (per user/lesson), `learn_quiz_attempts`, `learn_completions`. RLS: crew and admin read published courses; each user reads/writes only their own progress and attempts; admins full access.
- `src/lib/learn.ts` (shared types/helpers), `src/lib/learn.server.ts` (course generation from live data via the Lovable AI gateway, same pattern as `run-sheet.server.ts` / `venue-scrape.server.ts`), `src/lib/learn.functions.ts` (server fns gated on the crew/admin role check).
- Routes: `src/routes/crew.learn.tsx` (channel picker + progress), `crew.learn.$courseId.tsx` (module list), `crew.learn.$courseId.$moduleId.tsx` (lesson player + quiz), `admin.learn.tsx`.
- Crew tab set in `src/components/app-shell.tsx` gains a **Learn** entry.
- Department course links straight into the existing `/crew/department/$id` page and waiver flow rather than duplicating it.
- Registration-day numbering uses the existing `event-days.ts` helper throughout.
