# Live Rider Tracking — Design, Cost & Feasibility

A proposal for live GPS tracking of riders during events, with a spectator view, SOS, and a practical answer on data, battery and running costs based on **500 riders + 500 spectators over a 4-hour race**.

## How it would look

### Rider side (in the existing app, builds on the current Tracker/SOS panel)
- Big "Start tracking" button on their Events Hub / My Event page on race morning.
- App captures GPS every **30 seconds** and uploads a small bundle of points (batched every 2–5 min to save battery).
- Riders see: tracking on, last upload time, SOS button.
- Works as a PWA page — no app-store app needed. Optional: keep screen unlocked prompt.

### Spectator side
- Public "Watch live" page per event (link shared via WhatsApp/email/social).
- A map with a dot per rider, bib number and name on tap, leader highlighted.
- "Follow my rider": search a name → map follows them, shows distance done, speed, est. position on route.
- Optional auto-refresh leaderboard (position along route, not just speed).

### Race control (admin)
- Live map of all riders, SOS alerts in red, "stopped for >10 min" alerts, stragglers/sweep-vehicle view.

## Technical architecture

```text
Rider phone (GPS every 30s, batched upload)
      │  POST ~5–10 points per call
      ▼
Supabase table: tracking_points (rider, event, lat, lng, ts, battery)
      │
      ├──► Supabase Realtime broadcast channel per event
      │         └──► spectator map pages subscribe (read-only)
      └──► SOS table → instant push notification to race control
```

- Inserts via a server function (validates the rider owns the entry).
- Spectators never read the raw table — they subscribe to a Realtime broadcast channel, so 500 watchers cost the same as 50.
- Points older than ~30 days auto-purged to keep storage near zero.

## Will it eat riders' data? — No

Per rider, 4-hour race, point every 30s:
- 480 points × ~100 bytes = **~50 KB for the whole race** (less than loading one photo on Instagram).
- Even with retries/overhead: **well under 1 MB**.

## Will it eat riders' battery? — Manageable

- GPS active for 4 hours ≈ **20–35% battery** on a typical phone (screen off).
- Batching uploads (send every 2–5 min instead of every point) and a "dim screen" tracking page cuts this further.
- Recommendation to riders: start at 80%+ or carry a small power bank — standard for endurance events.

## What does it cost YOU to run? (500 riders, 500 spectators, 4h)

| Item | Volume | Cost |
|---|---|---|
| GPS point uploads | 500 riders × 480 pts = 240k rows/day (~10 MB DB) | Included |
| Realtime messages to spectators | ~240k broadcasts fanned out | Included in Realtime quota |
| Spectator page loads | 500 × light page + map tiles (cached by our service worker) | ~Free |
| Supabase plan needed | Pro likely sufficient; concurrent-connections limit is the one to watch | ~$25/month |
| Map tiles | OpenStreetMap/Esri already used, cached offline | Free |

**Realistic total: roughly R500/month (Supabase Pro) during the months you use it — no per-rider or per-spectator fees.** Compare: commercial tracking (FollowMyChallenge/Maprogress-type services) typically charges events thousands of rand per race.

### The one scaling watch-out
Supabase Realtime has a concurrent-connections cap per plan. 500 riders + 500 spectators = ~1,000 simultaneous connections — fits on Pro, but if an event grows to several thousand concurrent watchers we'd add a thin relay (single server-side subscription re-broadcasting) or move spectator updates to 15-second polling, which costs almost nothing.

## Build phases

1. **Phase 1 — core tracking:** tracking_points table + RLS, rider "start tracking" page with batching, race-control live map.
2. **Phase 2 — spectator page:** public watch-live map, follow-a-rider, share link.
3. **Phase 3 — safety & polish:** SOS push to race control, stopped-rider alerts, auto-purge, battery-saver mode, offline queueing (points stored on phone when there's no signal, uploaded when signal returns — important for rural stages like Addo/Hogsback).

## Notes
- No tracking = no signal works fine: points queue on the device and catch up later; spectators just see the rider "jump" when back in coverage.
- Privacy: tracking is opt-in per ride, only active while the rider presses start, and spectator pages only show riders who started tracking.
