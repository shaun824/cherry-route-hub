# Fix the run sheet import (no departments coming through)

## What I found

- No PE Plett event has a run sheet link saved. The only event with a linked sheet is **Tour de Addo 2027 | Best of Darlington Dam** — so either the link was saved while that event was selected in the picker, or it was never saved for PE Plett.
- That linked sheet did run a sync (19 Aug) with **no error**, but it produced **0 departments, 0 tasks, 0 packing rows**. So the reader reached the sheet and understood nothing in it.

Why nothing was understood: the importer only reads the **first tab** for tasks (range `A1:Z5000`), assumes **row 1 is the header row**, and requires two columns named close to `Department` and `Task`. It also only looks for extra data in tabs named exactly `Packing` and `Brief`. A real-world run sheet (title rows above the headers, per-department tabs, a "Time / Who / What" layout) parses to nothing — and the sync reports success because zero valid rows is not treated as an error.

## What to change

### 1. Make the reader work with real run sheets

- Read the sheet's tab list first, then scan every tab instead of only the first one.
- Find the header row anywhere in the first ~15 rows of a tab (the row with the most recognised column names), rather than assuming row 1.
- Widen column matching: `Department / Dept / Area / Team / Crew`, `Task / Job / What / Activity / Instruction`, `Time / Start`, `Who / Owner / Responsible`, plus existing aliases.
- When a tab has no Department column but the tab itself is named after a department (e.g. a "Registration" tab), use the tab name as the department for every row in it.
- Keep `Packing` / `Brief` tab handling, and also match tabs whose name contains "packing" or "brief".

### 2. Stop silent empty syncs

- If a sync finds zero departments, record it as an error on the event ("Read the sheet but found no Department/Task columns") instead of a clean success, and surface it in the admin screen.

### 3. Better admin feedback

- The Preview button reports per tab: tab name, header row used, rows read, rows skipped, and the column names it did not recognise. That makes a mismatch obvious in one click.
- Show, next to the event picker, which event the link is being saved against, and warn when the selected event already has a different sheet linked.

### 4. Link it to PE Plett

Once the reader is fixed, save the sheet URL against the correct PE Plett event and run the sync; if the Tour de Addo link was a mis-click, clear it.

## Technical notes

- `src/lib/run-sheet.server.ts`: add a `spreadsheets/{id}?fields=sheets.properties.title` gateway call, a `findHeaderRow` helper, per-tab parsing loop, tab-name fallback for department, and a zero-department error path in `syncEventRunSheet`.
- `src/lib/run-sheet.functions.ts`: extend `previewRunSheet`'s return with the per-tab diagnostics.
- `src/routes/admin.run-sheet.tsx`: render the per-tab preview table and the linked-event warning.
- No schema changes; existing `run_sheet_error` / `run_sheet_rows` columns carry the new state.

## To confirm

I can't see the sheet contents from here. If the sync still finds nothing after this, sharing the sheet's tab names and its header row will pin it down immediately.
