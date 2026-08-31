# Event load-out: one inventory system for PE and the field team

Turn the Grabouw logistics doc into a live tool: one master kit catalogue, a per-event load list grouped into the same sections you already use, vehicle runs with drivers and dates, and progress ticks the PE team and the on-site team share in real time.

## What you get

**1. Master kit catalogue (replaces the branding-only catalogue)**
Every item Red Cherry owns, in one list: name, category (Start/finish, Sound, Chill zone, Marking, Showers, Village signs, Race boards, Tented village, Waterholes, Branding, Extras), size/spec, sponsor, quantity owned, and a **home location** (PE store, Cape Town, Container, Supplier, Other). Branding becomes one category inside this — the existing branding bookings, village-map pin drop and packing-list push all keep working.

**2. Per-event load list**
Book items into an event with a quantity, a per-event location override ("In CT already", "Shaun fetching in CT"), a note, and an optional department. Grouped by category exactly like your doc, with a running "what's on the truck" summary per category and per location (From PE / In CT / Container).

**3. Shared progress ticks**
Each line moves through **Packed → On site → Setup → Returned**. Every tick records who did it and when, so PE can pack while the field team sees it land, and nothing goes missing on the way home. Big tap targets, works on a phone, offline-tolerant.

**4. Logistics timeline (vehicle runs)**
Per event: date, direction (out / return), driver(s), vehicle ("8 Ton Green Motion", "Ford Ranger"), and free-text "taking" notes. Load-list lines can be assigned to a run, so each driver gets their own load sheet. Runs show on the crew dashboard as a countdown timeline for the build week.

**5. Ties into what already exists**
- Branding lines still drop pins on the village build map.
- One tap pushes the whole load list (or one category) into a department's packing list.
- Uses the shared crew event selector, so picking your event once carries through.

**6. Seeded with Weekend Warrior Grabouw 2026**
The full doc is loaded in as real data — all nine sections with quantities, the PE/CT flags, and both vehicle runs (Tue 14 April out, Sun 19 April return to PE) — so you can drive a real list before building Lourensford. Because that event has already passed, the inventory page gets a "show past events" toggle so you can still open it.

## Where it lives

Crew → Inventory management, upgraded to three tabs:
- **Load list** — this event's kit by section, with the tick states
- **Logistics** — vehicle runs and who is driving what
- **Catalogue** — the master kit list

Admins get the same view plus the push-to-packing-list and seeding actions.

## Technical detail

Migration:
- `branding_inventory` → gains `category`, `home_location`; kept as the master catalogue (renamed in code as `inventory_items` type, table name unchanged to avoid breaking existing rows).
- `event_branding_bookings` → gains `category`, `location`, `run_id`, `packed_at/by`, `on_site_at/by`, `setup_at/by`, `returned_at/by`. Existing branding rows default to `category = 'branding'`.
- New `event_logistics_runs` (event_id, run_date, direction, driver, vehicle, taking, notes, sort_order) with GRANTs, RLS, crew read / admin+crew write, and a touch trigger.
- Seed INSERTs for the Grabouw 2026 packing list and two runs, in the same migration.

Code:
- `src/lib/branding-inventory.ts` widened into `src/lib/inventory.ts` (categories, locations, tick-state helpers, run CRUD, grouped totals); branding helpers re-exported so `branding-to-place.tsx` and the village editor are untouched.
- `src/routes/crew.inventory.tsx` rebuilt with the three tabs, section grouping, tick buttons and the past-event toggle.
- `src/lib/crew-event.ts` gains an opt-in "include past events" mode used by this page.
- Crew dashboard tile shows the next vehicle run and the outstanding-to-pack count.
