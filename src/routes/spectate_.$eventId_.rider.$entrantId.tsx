import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clock, Flag, Hash, Lock, Trophy, Users } from "lucide-react";
import { getRiderDetail, type RiderDetailPayload } from "@/lib/results.functions";
import { useSession } from "@/lib/auth";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { brandHeader } from "@/lib/event-brand";

export const Route = createFileRoute("/spectate_/$eventId_/rider/$entrantId")({
  head: () => ({
    meta: [
      { title: "Rider details — Red Cherry Events" },
      {
        name: "description",
        content:
          "Race number, start batch and day-by-day results for a rider at this Red Cherry event.",
      },
      { property: "og:title", content: "Rider details — Red Cherry Events" },
      {
        property: "og:description",
        content: "Race number, start batch and day-by-day results for this rider.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RiderDetailPage,
});

function timeOnly(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function RiderDetailPage() {
  useHydratedStore();
  const { eventId, entrantId } = Route.useParams();
  const event = useAdminStore((s) => s.events.find((e) => e.id === eventId));
  const { user } = useSession();

  const fetchDetail = useServerFn(getRiderDetail);
  const q = useQuery<RiderDetailPayload>({
    queryKey: ["rider-detail", eventId, entrantId, user?.id ?? "guest"],
    queryFn: () => fetchDetail({ data: { eventId, entrantId } }),
    staleTime: 60_000,
  });

  const rider = q.data?.rider ?? null;
  const batchStart =
    rider?.batch && event?.batches
      ? event.batches.find((b) => b.name === rider.batch)?.startTime ?? null
      : null;
  const startedAt = timeOnly(rider?.started_at ?? null);
  const finishedAt = timeOnly(rider?.finished_at ?? null);
  const sets = q.data?.sets ?? [];
  const withResults = sets.filter((s) => s.row);

  return (
    <div className="pb-10">
      <div
        className={`relative overflow-hidden ${brandHeader(event?.heroColor).className} px-5 pb-6 text-white`}
        style={{
          ...brandHeader(event?.heroColor).style,
          paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)",
        }}
      >
        <Link
          to="/spectate/$eventId"
          params={{ eventId }}
          aria-label="Back"
          className="absolute left-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
          {q.data?.event_name ?? event?.name ?? "Rider"}
        </span>
        <h1 className="mt-1 font-display text-2xl font-bold leading-tight">
          {rider?.full_name ?? (q.isLoading ? "Loading…" : "Rider")}
        </h1>
        {rider?.category ? <p className="mt-1 text-sm opacity-90">{rider.category}</p> : null}
      </div>

      <div className="px-5 pt-5 space-y-4">
        {q.data?.status === "signin" ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <Lock className="mx-auto h-5 w-5 text-cherry" />
            <p className="mt-2 text-sm font-semibold text-ink">Riders only</p>
            <p className="mt-1 text-sm text-ink-soft">
              Sign in to see race numbers, start times and results.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-block rounded-full bg-cherry px-5 py-2 text-sm font-semibold text-white"
            >
              Sign in
            </Link>
          </div>
        ) : q.data?.status === "not_found" ? (
          <p className="text-center text-sm text-ink-soft">That rider isn’t on this event list.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Hash} label="Race number" value={rider?.bib_number || "TBC"} />
              <StatCard
                icon={Clock}
                label="Start time"
                value={batchStart || startedAt || "TBC"}
              />
              <StatCard icon={Users} label="Start batch" value={rider?.batch || "—"} />
              <StatCard icon={Flag} label="Finished" value={finishedAt || "—"} />
            </div>

            <section>
              <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
                Day-by-day results
              </h2>
              {q.isLoading ? (
                <p className="mt-3 text-sm text-ink-soft">Loading results…</p>
              ) : withResults.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
                  <Trophy className="mx-auto h-5 w-5 text-cherry" />
                  <p className="mt-2">
                    No results captured for this rider yet — each day’s times will appear here as
                    they’re published.
                  </p>
                </div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {withResults.map((s) => (
                    <li key={s.id} className="rounded-2xl bg-card p-3 ring-1 ring-border">
                      <div className="flex items-center gap-2">
                        <p className="font-display text-sm font-bold text-ink">{s.label}</p>
                        {s.row?.position ? (
                          <span className="ml-auto rounded-md bg-accent px-2 py-0.5 font-mono text-[11px] font-bold text-cherry-deep">
                            #{s.row.position}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                        {s.row?.time_text ? (
                          <span className="font-mono text-sm font-semibold text-ink">
                            {s.row.time_text}
                          </span>
                        ) : null}
                        {s.row?.gap_text ? <span>+{s.row.gap_text.replace(/^\+/, "")}</span> : null}
                        {s.row?.status ? <span className="uppercase">{s.row.status}</span> : null}
                        {s.row?.category ? <span>{s.row.category}</span> : null}
                      </div>
                      {s.row && Object.keys(s.row.extras).length > 0 ? (
                        <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-ink-soft">
                          {Object.entries(s.row.extras).map(([k, v]) => (
                            <div key={k} className="truncate">
                              <dt className="inline font-semibold">{k}: </dt>
                              <dd className="inline">{String(v)}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <Link
          to="/spectate/$eventId"
          params={{ eventId }}
          className="block pt-2 text-center text-sm font-semibold text-cherry"
        >
          Back to rider list
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
        <Icon className="h-3.5 w-3.5 text-cherry" />
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold text-ink">{value}</p>
    </div>
  );
}
