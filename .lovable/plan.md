# Super Admin Backend with RBAC

Replace the current localStorage-only admin with a real backend on Lovable Cloud, gated by Google sign-in and an `admin` role. `shaun@redcherryevents.co.za` is auto-promoted on first login. All riders can sign in; only admins can access `/admin`.

## What you'll get

- **Google sign-in** for everyone. Signed-out visitors keep the marketing/rider view.
- **Rider profiles** auto-created on signup (name, phone, emergency contact, apparel sizes, Entry Ninja ID).
- **Super admin console** at `/admin` — protected by role, not just login:
  - Events + rider entries (view who entered, sizes, merch, payment status)
  - News feed + gallery (create/edit/pin/delete posts and media)
  - Promos + sponsors (CRUD, logo scroller stays live)
  - Riders + roles (list all riders, grant/revoke admin)
- **Public pages** (Home, Events, Feed, Promos, Gallery) read live from Cloud so admin edits appear instantly on every device — no more per-browser localStorage.

## Database (new)

```text
profiles              (id=auth.users.id, full_name, phone, emergency_contact,
                       tshirt_size, jacket_size, entry_ninja_id, created_at)
app_role  enum        ('admin', 'rider')
user_roles            (id, user_id, role) — separate table, never on profile
events                (id, name, discipline, date, location, distance,
                       status, entry_ninja_id, description, hero_gradient,
                       created_at)
feed_posts            (id, type, title, body, author, pinned, created_at)
promos                (id, brand, title, code, discount, expires, accent)
sponsors              (id, name, tier, logo_text, accent, url, active, sort)
media_posts           (id, caption, image_url, event_id, created_at)
entries               (id, event_id, user_id, category, tshirt_size,
                       jacket_size, merch jsonb, total_cents,
                       payment_status, payment_ref, created_at)
```

- `has_role(uuid, app_role)` security-definer function for RLS.
- Trigger on `auth.users` insert: create profile row; if email = `shaun@redcherryevents.co.za` and confirmed, insert `user_roles(admin)`.
- Seed migration inserts the current mock events, sponsors, promos, and feed posts so the app looks the same on day one.

## Access rules (RLS)

| Table | anon | authenticated (rider) | admin |
|---|---|---|---|
| events, feed_posts, promos, sponsors, media_posts | read | read | full CRUD |
| profiles | — | read/update own | read all |
| entries | — | read/insert own | read all |
| user_roles | — | read own | full CRUD |

## Routes

- `/auth` — public Google sign-in page (used by both riders and admins).
- `/admin/*` — moved under `_authenticated/` and further gated by an `admin` role check in the layout `beforeLoad`; non-admins get "Not authorised".
- Existing public pages unchanged visually — data source swaps to server functions.
- New `/admin/riders` page: list profiles + role toggle.
- New `/admin/entries` view under each event: list all riders who entered.

## Technical section

- Enable Lovable Cloud, then `supabase--configure_social_auth` for Google.
- All admin reads/writes go through `createServerFn` handlers using `requireSupabaseAuth`; role verified via `has_role(auth.uid(), 'admin')` inside each mutating handler.
- Public reads (home, events list, feed, promos, sponsors) use a server publishable client with narrow `TO anon` SELECT policies.
- Replace `src/lib/store.ts` (zustand) with TanStack Query hooks pointing at the new server fns. `useAdminStore` is removed; `SponsorScroller` reads from a public query.
- Keep the existing entry form; on payment success, insert an `entries` row tied to `auth.uid()`.
- `__root.tsx` gets a single `onAuthStateChange` subscriber for router invalidation.
- The `/admin` layout hides itself for signed-out users and shows an "Access denied" panel for signed-in non-admins.

## Out of scope (say if you want these next)

- Real Stripe (still mock checkout).
- Real Entry Ninja API sync (fields are stored, endpoint stubbed).
- Push notifications.
- Editing rider profiles as admin (read-only for now; role toggle only).

Approve and I'll enable Cloud, run the migration, wire Google, and migrate the admin console.
