# Run sheets and department onboarding for crew

Turn the master Excel run sheet into a living, per-department onboarding and daily-instructions area inside the crew tools, fed from Google Sheets so you keep editing where you already work.

## How it works for a temp staff member

1. They sign in at the existing crew door (`/crew/login`) with the crew account you issue.
2. First time they open a department they get **guided onboarding**:
   - What this department does and who leads it (role brief)
   - Safety and site rules
   - Kit and packing list for the role
   - Key contacts
   - A **liability waiver** pop-up they must read and accept before the daily instructions unlock
3. Once accepted, they land on their department home: today's instructions, hour-by-hour, plus the packing list and contacts always one tap away.
4. Waiver acceptance is recorded (name, department, event, timestamp) and visible to admins.

## How the run sheet gets in

You keep one Google Sheet per event (or one sheet with a tab per department). The app pulls it on demand and on a schedule, exactly like the rooming sync already does.

Expected columns (extra columns are kept as notes):

```text
Department | Day | Start | End | Task | Detail | Owner | Location | Notes
```

Plus an optional `Packing` tab:

```text
Department | Item | Qty | Notes | Critical (Y/N)
```

And an optional `Brief` tab:

```text
Department | Lead | Contact | Overview | Safety notes
```

Day labels follow the existing rule: day 1 is registration day unless the sheet says otherwise.

Admin screen shows a preview of what was read before it goes live, the last sync time, and any rows the parser couldn't understand.

## Packing lists that improve over time

Crew can tick items on the day and add a suggestion ("we needed a second gazebo weight"). Suggestions land in an admin review queue; approving one appends it to the app's list and flags it so you can paste it back into the master sheet. Nothing crew adds changes the sheet directly.

## Screens

- `/crew` dashboard: adds a "My department" card and a department picker for people covering more than one.
- `/crew/run-sheet`: day tabs, department filter, timeline of tasks with times, tick-off, and current-time marker.
- `/crew/department/$id`: brief, safety, contacts, packing list, waiver status.
- `/admin/run-sheet`: link the sheet, sync, preview parsed rows, assign crew accounts to departments, review packing suggestions, view waiver acceptances.

## Technical notes

- New tables: `event_departments`, `run_sheet_tasks`, `department_packing_items`, `crew_department_assignments`, `crew_task_state`, `packing_suggestions`, `crew_waivers`. RLS: crew read their event's rows, write only their own tick-off/suggestion/waiver rows; admins full access.
- Sheet read reuses the existing Google Sheets connector gateway pattern in `src/lib/rooming-sheet.server.ts`; new `run-sheet.server.ts` parser plus `run-sheet.functions.ts` server functions gated on the crew/admin role check.
- Scheduled pull via a `/api/public/hooks/run-sheet-sync` route, same shape as the rooming sheet cron.
- Crew nav gains the run sheet entry through the existing crew-mode tab set.
- Waiver text stored in `site_settings` so you can edit it without a code change.
