// Everyone entered on the signed-in rider's registrations (family / group
// entries), so people who aren't the main ticket holder are visible too.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  event_id: string;
  event_name: string;
  event_date: string;
  group_ref: string;
  full_name: string;
  category: string | null;
  batch: string | null;
  bib_number: string | null;
  is_me: boolean;
};

export function MyRegistrationCard({ eventId, embedded }: { eventId?: string; embedded?: boolean } = {}) {
  const { data } = useQuery({
    queryKey: ["my-registration-members"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("my_registration_members");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = data ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (eventId ? r.event_id !== eventId : new Date(r.event_date).getTime() < today.getTime()) continue;
    const k = `${r.event_id}|${r.group_ref}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const list = [...groups.values()].filter((g) => g.length > 1);
  if (list.length === 0) return null;

  return (
    <section className={embedded ? "mt-4 border-t border-border pt-4" : "mx-5 mt-4 rounded-2xl bg-card p-4 ring-1 ring-border"}>
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-cherry" />
        <p className="font-display text-base font-bold text-ink">People on your entry</p>
      </div>
      <p className="mt-1 text-xs text-ink-soft">Everyone entered on the same registration as you.</p>
      <div className="mt-3 space-y-4">
        {list.map((g) => (
          <div key={`${g[0]!.event_id}${g[0]!.group_ref}`}>
            <Link
              to="/my-events/$eventId"
              params={{ eventId: g[0]!.event_id }}
              className="text-sm font-semibold text-cherry"
            >
              {g[0]!.event_name}
            </Link>
            <ul className="mt-2 divide-y divide-border rounded-xl ring-1 ring-border">
              {g.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {m.full_name}
                      {m.is_me ? <span className="ml-1 text-xs text-ink-soft">(you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {[m.category, m.batch ? `Batch ${m.batch}` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-ink">
                    {m.bib_number ? `#${m.bib_number}` : "No. TBC"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
