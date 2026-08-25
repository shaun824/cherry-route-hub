import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSignIns, type SignInRow } from "@/lib/sign-ins.functions";
import { LogIn, Search, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/sign-ins")({
  head: () => ({
    meta: [
      { title: "Sign-in activity · Red Cherry Admin" },
      { name: "description", content: "See exactly who is logging in to the Red Cherry rider app and when." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SignInsAdmin,
});

function since(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function withinDays(iso: string | null, days: number) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= days * 86400000;
}

const FILTERS = [
  { key: "24h", label: "Last 24h", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "all", label: "Everyone", days: 0 },
] as const;

function SignInsAdmin() {
  const fetchSignIns = useServerFn(listSignIns);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("7d");

  const query = useQuery({
    queryKey: ["admin", "sign-ins"],
    queryFn: () => fetchSignIns({}) as Promise<SignInRow[]>,
  });

  const rows = query.data ?? [];

  const stats = useMemo(
    () => ({
      day: rows.filter((r) => withinDays(r.last_sign_in_at, 1)).length,
      week: rows.filter((r) => withinDays(r.last_sign_in_at, 7)).length,
      month: rows.filter((r) => withinDays(r.last_sign_in_at, 30)).length,
      never: rows.filter((r) => !r.last_sign_in_at).length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const days = FILTERS.find((f) => f.key === filter)?.days ?? 0;
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (days && !withinDays(r.last_sign_in_at, days)) return false;
      if (!term) return true;
      return (
        (r.email ?? "").toLowerCase().includes(term) ||
        r.full_name.toLowerCase().includes(term) ||
        r.roles.join(" ").includes(term)
      );
    });
  }, [rows, filter, q]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-xl font-bold">
            <LogIn className="h-5 w-5 text-primary" /> Sign-in activity
          </h1>
          <p className="text-sm text-ink-soft">Every account on the app and the last time they logged in.</p>
        </div>
        <button
          onClick={() => void query.refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Signed in today", value: stats.day },
          { label: "Last 7 days", value: stats.week },
          { label: "Last 30 days", value: stats.month },
          { label: "Never signed in", value: stats.never },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3">
            <div className="font-display text-2xl font-bold">{s.value}</div>
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email or role"
            className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                filter === f.key ? "bg-ink text-white" : "border border-border bg-card"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-ink-soft">Loading sign-ins…</p>
      ) : query.error ? (
        <p className="text-sm text-destructive">{(query.error as Error).message}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-soft">No accounts match that.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{r.full_name || r.email || "Unknown"}</span>
                    {r.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      >
                        {role}
                      </span>
                    ))}
                    {!r.confirmed && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        unconfirmed
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-ink-soft">
                    {r.email ?? "no email"}
                    {r.providers.length ? ` · ${r.providers.join(", ")}` : ""}
                    {` · joined ${new Date(r.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{since(r.last_sign_in_at)}</div>
                  <div className="text-[11px] text-ink-soft">
                    {r.last_sign_in_at
                      ? new Date(r.last_sign_in_at).toLocaleString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "no sign-in yet"}
                  </div>
                </div>
                <Link
                  to="/admin/rider/$userId"
                  params={{ userId: r.id }}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
