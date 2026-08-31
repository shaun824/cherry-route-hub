import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, History, KeyRound, LogIn, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { useSession } from "@/lib/auth";
import { fetchMyEvents } from "@/lib/my-events";
import { linkMyEntry, getMyEntrant } from "@/lib/roster.functions";
import { useServerFn } from "@tanstack/react-start";
import { UpcomingBySport } from "@/components/upcoming-by-sport";
import { getEventSport } from "@/lib/event-sport";
import { brandHeader } from "@/lib/event-brand";
import { EventLogo } from "@/components/event-logo";
import { SyncMyEntryButton } from "@/components/sync-my-entry";

export const Route = createFileRoute("/my-events/")({
  component: MyEventsIndex,
});

function MyEventsIndex() {
  const { user, loading } = useSession();

  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center text-sm text-ink-soft">Loading…</div>;
  }
  if (!user) return <SignedOutState />;
  return <SignedInState />;
}

function SignedOutState() {
  return (
    <div>
      <PageHeader title="Events Hub" subtitle="Sign in to see your events" />
      <div className="mx-5 mt-4 rounded-2xl bg-card p-6 text-center ring-1 ring-border">
        <LogIn className="mx-auto h-8 w-8 text-cherry" />
        <p className="mt-3 font-display text-lg font-bold text-ink">Sign in to continue</p>
        <p className="mt-1 text-sm text-ink-soft">
          Your entered events, race info, packing lists and chat live behind sign-in so we can match
          you to your Entry Ninja entries.
        </p>
        <Link
          to="/auth"
          search={{ next: "/my-events" }}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl cherry-gradient px-5 py-2.5 text-sm font-bold text-white"
        >
          Sign in <ChevronRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-xs text-ink-soft">
          Not entered yet? You can still{" "}
          <Link to="/events" className="font-semibold text-cherry">
            browse every Red Cherry event
          </Link>{" "}
          — schedules, venues and route details are open to everyone.
        </p>
      </div>
      <UpcomingBySport heading="Events coming up" />
      <div className="pb-6" />
    </div>
  );
}

function SignedInState() {
  const qc = useQueryClient();
  const [showPast, setShowPast] = useState(false);
  const entrantQuery = useQuery({
    queryKey: ["my-entrant"],
    queryFn: () => getMyEntrant(),
  });
  const eventsQuery = useQuery({
    queryKey: ["my-events"],
    queryFn: () => fetchMyEvents(),
    enabled: Boolean(entrantQuery.data),
  });

  if (entrantQuery.isLoading) {
    return <div className="grid min-h-[30vh] place-items-center text-sm text-ink-soft">Loading…</div>;
  }
  if (!entrantQuery.data) {
    return <LinkEntrantForm onLinked={() => qc.invalidateQueries({ queryKey: ["my-entrant"] })} />;
  }

  const rows = eventsQuery.data ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = rows.filter((r) => new Date(r.event.event_date).getTime() >= today.getTime());
  const past = rows.filter((r) => new Date(r.event.event_date).getTime() < today.getTime());

  // Preferred sport: the sport of the rider's next upcoming event; if they have
  // no upcoming events, the sport they've ridden most.
  const preferredSport = useMemo<"moto" | "mtb" | null>(() => {
    const sportOf = (r: (typeof rows)[number]) =>
      getEventSport(r.event?.discipline, r.event?.name);
    if (upcoming.length > 0) return sportOf(upcoming[0]);
    if (rows.length === 0) return null;
    const mtbCount = rows.filter((r) => sportOf(r) === "mtb").length;
    return mtbCount * 2 >= rows.length ? "mtb" : "moto";
  }, [rows, upcoming]);

  return (
    <div>
      <PageHeader
        title="Events Hub"
        subtitle={`${upcoming.length} upcoming event${upcoming.length === 1 ? "" : "s"}`}
      />
      {upcoming.length === 0 ? (
        <div className="mx-5 mt-4 rounded-2xl border border-dashed border-border p-8 text-center">
          <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-ink-soft">
            No upcoming events on file. Just entered? Tap below to pull your latest Entry Ninja
            entries through.
          </p>
          <SyncMyEntryButton className="mt-4" />
        </div>
      ) : (
        <ul className="space-y-3 px-5 py-4">
          {upcoming.map((r) => (
            <EventRow key={r.event_entrant_id} r={r} />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <div className="px-5 pb-2">
          <button
            type="button"
            onClick={() => setShowPast((s) => !s)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card py-3 text-sm font-semibold text-ink ring-1 ring-border"
          >
            <History className="h-4 w-4 text-cherry" />
            {showPast ? "Hide past events" : `View past events (${past.length})`}
          </button>
        </div>
      )}

      {showPast && past.length > 0 && (
        <div className="px-5 pb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Events you've done
          </p>
          <ul className="space-y-3">
            {past.map((r) => (
              <EventRow key={r.event_entrant_id} r={r} />
            ))}
          </ul>
        </div>
      )}

      <UpcomingBySport excludeIds={rows.map((r) => r.event_id)} preferSport={preferredSport} />
      <div className="pb-6" />
    </div>
  );
}

function EventRow({ r }: { r: any }) {
  return (
    <li>
      <Link
        to="/my-events/$eventId"
        params={{ eventId: r.event_id }}
        className="block overflow-hidden rounded-2xl bg-card ring-1 ring-border active:scale-[0.99] transition-transform"
      >
        <div
          style={brandHeader(r.event.hero_color).style}
          className={`${brandHeader(r.event.hero_color).className} px-4 py-4 text-white`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
                {r.event.discipline}
              </p>
              <p className="font-display text-lg font-bold leading-tight">{r.event.name}</p>
            </div>
            <EventLogo src={r.event.logo_url} name={r.event.name} size="md" onBrand />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {new Date(r.event.event_date).toLocaleString("en-ZA", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {r.event.location}
            </p>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold">
              {r.category ? (
                <span className="rounded bg-accent px-1.5 py-0.5 text-cherry-deep">{r.category}</span>
              ) : null}
              {r.batch ? (
                <span className="rounded bg-secondary px-1.5 py-0.5 text-ink">Batch {r.batch}</span>
              ) : null}
              {r.bib_number ? (
                <span className="rounded bg-ink px-1.5 py-0.5 text-white">#{r.bib_number}</span>
              ) : null}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </Link>
    </li>
  );
}

function LinkEntrantForm({ onLinked, embedded }: { onLinked: () => void; embedded?: boolean }) {
  const linkFn = useServerFn(linkMyEntry);
  const [idNumber, setIdNumber] = useState("");
  const [surname, setSurname] = useState("");
  const [status, setStatus] = useState<null | string>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await linkFn({ data: { id_number: idNumber, surname } });
      if (res.ok) {
        setStatus("Linked! Pulling your events through…");
        onLinked();
      } else if (res.reason === "no_match") {
        setStatus(
          "We couldn't find an entry matching your email, or your ID number and surname. Ask Red Cherry admin to add you.",
        );
      } else if (res.reason === "id_mismatch") {
        setStatus("That ID number doesn't match what we have on file.");
      } else {
        setStatus("This entry is already linked to another account. Contact admin.");
      }
    } catch (err) {
      setStatus((err as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const form = (
      <form onSubmit={submit} className="mx-5 mt-4 space-y-3 rounded-2xl bg-card p-5 ring-1 ring-border">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-cherry" />
          <p className="font-display text-base font-bold text-ink">Confirm your identity</p>
        </div>
        <p className="text-xs text-ink-soft">
          We'll match your email to entries imported from Entry Ninja. Enter your ID number and
          surname to confirm it's you. We only ever store a scrambled version of your ID number.
        </p>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">ID number</span>
          <input
            required
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            maxLength={50}
            placeholder="e.g. 9204115000080"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Surname</span>
          <input
            required
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            maxLength={80}
            autoComplete="family-name"
            placeholder="As entered on Entry Ninja"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {status ? (
          <p className="rounded-lg bg-cherry/10 px-3 py-2 text-xs font-semibold text-cherry-deep">
            {status}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || idNumber.length < 4 || surname.trim().length < 2}
          className="w-full rounded-xl cherry-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "Checking…" : "Link my entry"}
        </button>
      </form>
      <UpcomingBySport heading="Events coming up" />
      <div className="pb-6" />
    </div>
  );
}
