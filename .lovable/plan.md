# Harden live tracking + race control for Weekend Warrior (17–18 Oct)

Safety-critical work, delivered in the order you set: SOS reliability first, then everyday map usability, then polish and testing.

## Schema change needed first (your approval required)

One migration on the SOS table, additive only (nothing dropped or renamed):

- `reason` (text: medical / mechanical / lost / other / checking-in)
- `note` (short text from the rider)
- `acknowledged_by`, `acknowledged_at` (who confirmed they saw it)
- `escalated_at` (set when the 90-second timer fires)
- status gains `acknowledged` and `cancelled` alongside active/resolved
- a policy letting a rider cancel/downgrade their own alert

Everything else below works on the existing tables.

## 1. SOS that actually interrupts race control

- Full-screen takeover on the crew/admin screen the moment a new active alert lands, with an alarm sound that keeps repeating, a Mute action, and the tab title plus favicon flashing so it's noticed on an unfocused tab.
- Push notification to every crew/admin device for each new alert, using the existing push setup — no need for anyone to have the tracking page open.
- **Acknowledge** (a human has seen it, stops the alarm) is separate from **Resolve** (incident closed). Both record who and when.
- Escalation: unacknowledged after 90 seconds, the alarm gets louder and more insistent and a second push goes to all other crew/admin accounts.
- Rider side: pick a reason (medical / mechanical / lost / other / just checking in) plus an optional note before sending; the reason shows large on the race-control card.
- Accidental-tap guard: press-and-hold for 2 seconds to send, with a visible fill ring. After sending, the rider gets a clear **I'm okay now** button that cancels the alert and updates race control within a poll.

## 2. SOS riders unmistakable on the map

Alert riders get a pulsing red siren marker that overrides the normal active/stale colouring, is readable at every zoom, and never joins a cluster. Tapping it opens the same alert detail and navigate actions as the list.

## 3. Real marker clustering

Distance-based clustering (the clustering library is already installed) styled as one neutral circular badge with a rider count, sized by group size — not the stock look. Clicking a cluster zooms to its bounds; very tight groups fan out with leader lines instead of forcing more zoom. On by default for race control, available on the spectator map. SOS riders always excluded.

## 4. Smooth movement instead of teleporting dots

Each marker eases from its previous position to the new one across the poll interval, so riders read as travelling. Gaps from an offline catch-up jump rather than drawing a false straight-line sprint.

## 5. Follow-a-rider like Google Maps

Following recentres smoothly; the moment the viewer pans or zooms, follow pauses and a **Resume following** button appears. The followed rider is remembered per event in the browser, so a partner reopening the page later keeps tracking the same person.

## 6. Course progress

Project each rider's last point onto the course line to get distance covered, percent complete and a rough finish ETA from their average pace — shown in the popup, the search results and the new list view: "18.4 km of 42 km · ~44% · ETA 13:20".

## 7. Declutter finished riders and scope to the day

The live view starts from the current stage's start time instead of a rolling 12 hours, and riders with a finish time move into a collapsed **Finished (N)** group that's off by default.

## 8. Stopped / off-course safety net

A quiet warning list on race control (never a siren, never competing with real alerts), sorted by longest-stopped: riders who haven't moved meaningfully for a set number of minutes away from the village/aid points, and riders whose recent points sit well off every course line.

## 9. Triage list view

A sortable table beside the map: active alerts always pinned top, then sortable by last-seen, category/batch, stopped flag, and distance/bearing from race control's own position. Toggle between map, list, or split.

## 10. iPhone background-tracking risk

Confirmed real: in Safari, without the app installed to the home screen, position updates stop within seconds of the screen locking. So: the install prompt appears prominently inside the tracking flow explaining it's required for tracking with the screen off; starting tracking uninstalled shows a persistent warning rather than silence; plus a short on-the-ground test script for you to run at Lourensford (lock the phone, ride 10+ minutes, confirm points caught up).

## 11. Polish

Footer copy corrected to the real 3-second refresh; faint accuracy circle around each dot; the unused SOS count field on the live feed wired up properly; and a distinct **lost signal** state at 10+ minutes versus **stale** at 5.

## 12. Test plan

A written pre-race checklist plus the parts I can run here: 300+ simulated riders seeded to check clustering and list performance, offline queue catch-up, and the full alert → alarm → acknowledge → escalate flow from a second browser acting as race control. Battery drain and real iPhone lock-screen behaviour need your device on the day.

## Cost note at 300+ riders

Recording every 3 seconds for 300 riders over 5 hours is roughly 1.8 million rows and a lot of write traffic. Clustering and day-scoping cut the read side, but if you want, I can move recording to 5 seconds with no meaningful loss of map quality — roughly 40% less database load. Say the word and I'll set it there.
