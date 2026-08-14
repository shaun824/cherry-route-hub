import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, Shirt, Tent, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { paymentStatus } from "@/lib/payment-status";


export const Route = createFileRoute("/admin/rider/$userId")({
  component: RiderProfile,
});

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  entry_ninja_id: string | null;
  jacket_size: string | null;
  tshirt_size: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
};

type Entry = {
  id: string;
  event_id: string;
  category: string | null;
  batch: string | null;
  bib_number: string | null;
  registration_ref: string | null;
  jacket_size: string | null;
  tshirt_size: string | null;
  extras: unknown;
  paid: boolean | null;
  amount_due_cents: number | null;
  amount_paid_cents: number | null;
  event: { id: string; name: string; event_date: string | null } | null;
};

type Rooming = {
  id: string;
  event_id: string;
  tent_number: string | null;
  room_type: string | null;
  notes: string | null;
};

type ActivityRow = {
  id: string;
  event_name: string;
  path: string;
  route_label: string | null;
  duration_ms: number | null;
  device: string | null;
  created_at: string;
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function RiderProfile() {
  const { userId } = Route.useParams();

  const q = useQuery({
    queryKey: ["admin", "rider", userId],
    queryFn: async () => {
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select(
          "id,email,full_name,phone,entry_ninja_id,jacket_size,tshirt_size,emergency_contact_name,emergency_contact_phone,created_at",
        )
        .eq("id", userId)
        .maybeSingle();
      if (pErr) throw pErr;

      const { data: entrants } = await supabase.from("entrants").select("id").eq("user_id", userId);
      const entrantIds = (entrants ?? []).map((e) => e.id as string);

      let entries: Entry[] = [];
      let rooming: Rooming[] = [];
      if (entrantIds.length) {
        const { data: e } = await supabase
          .from("event_entrants")
          .select(
            "id,event_id,category,batch,bib_number,registration_ref,jacket_size,tshirt_size,extras,paid,amount_due_cents,amount_paid_cents,event:events(id,name,event_date)",
          )
          .in("entrant_id", entrantIds);
        entries = (e ?? []) as unknown as Entry[];

        const { data: r } = await supabase
          .from("event_rooming")
          .select("id,event_id,tent_number,room_type,notes")
          .in("entrant_id", entrantIds);
        rooming = (r ?? []) as Rooming[];
      }

      const { data: acts } = await supabase
        .from("analytics_events")
        .select("id,event_name,path,route_label,duration_ms,device,created_at")
        .eq("user_id", userId)
        .eq("event_name", "pageview")
        .order("created_at", { ascending: false })
        .limit(100);

      return {
        profile: (profile ?? null) as Profile | null,
        entries,
        rooming,
        activity: (acts ?? []) as ActivityRow[],
      };
    },
  });

  const d = q.data;

  return (
    <div className="space-y-5">
      <Link
        to="/admin/riders"
        className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-cherry"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to riders
      </Link>

      {q.isLoading ? (
        <p className="text-sm text-ink-soft">Loading rider…</p>
      ) : !d?.profile ? (
        <p className="text-sm text-ink-soft">No profile found for this rider.</p>
      ) : (
        <>
          <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <h1 className="font-display text-2xl font-bold">{d.profile.full_name ?? "Unnamed rider"}</h1>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {d.profile.email ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {d.profile.phone ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Shirt className="h-3.5 w-3.5" /> Jacket {d.profile.jacket_size ?? "—"} · Tee{" "}
                {d.profile.tshirt_size ?? "—"}
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              Emergency contact: {d.profile.emergency_contact_name ?? "—"}{" "}
              {d.profile.emergency_contact_phone ? `(${d.profile.emergency_contact_phone})` : ""} · Joined{" "}
              {fmtDate(d.profile.created_at)}
            </p>
          </div>

          <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <h2 className="font-display text-lg font-bold">Event entries</h2>
            {d.entries.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No entries linked to this rider.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {d.entries.map((e) => {
                  const room = d.rooming.find((r) => r.event_id === e.event_id);
                  const extras = Array.isArray(e.extras) ? (e.extras as Record<string, unknown>[]) : [];
                  return (
                    <li key={e.id} className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-semibold text-ink">{e.event?.name ?? e.event_id}</p>
                      <p className="text-xs text-ink-soft">
                        {fmtDate(e.event?.event_date)} · {e.category ?? "—"} · Batch {e.batch ?? "—"} · Bib{" "}
                        {e.bib_number ?? "—"}
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">
                        Jacket {e.jacket_size ?? "—"} · Tee {e.tshirt_size ?? "—"} · Entry Ninja ref{" "}
                        {e.registration_ref ?? "—"}
                      </p>
                      {(() => {
                        const ps = paymentStatus(e);
                        if (!ps) return null;
                        return (
                          <p
                            className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-bold ${
                              ps.state === "paid"
                                ? "bg-emerald-50 text-emerald-800"
                                : ps.state === "outstanding"
                                  ? "bg-amber-50 text-amber-900"
                                  : "bg-secondary text-ink-soft"
                            }`}
                          >
                            {ps.label}
                          </p>
                        );
                      })()}
                      {room ? (
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                          <Tent className="h-3.5 w-3.5" /> {room.room_type ?? "Tent"}{" "}
                          {room.tent_number ?? ""}
                        </p>
                      ) : null}
                      {extras.length ? (
                        <p className="mt-1 text-xs text-ink-soft">
                          Extras:{" "}
                          {extras
                            .map((x) => `${String(x.name ?? "")}${x.size ? ` (${String(x.size)})` : ""} ×${Number(x.qty ?? 1)}`)
                            .join(", ")}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold">
              <Activity className="h-4 w-4" /> Recent app activity
            </h2>
            {d.activity.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No tracked activity for this rider.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="pb-2">Screen</th>
                    <th className="pb-2">Device</th>
                    <th className="pb-2 text-right">When</th>
                  </tr>
                </thead>
                <tbody>
                  {d.activity.slice(0, 40).map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="py-2 pr-3">{a.route_label ?? a.path}</td>
                      <td className="py-2 capitalize text-ink-soft">{a.device ?? "—"}</td>
                      <td className="py-2 text-right text-xs text-ink-soft">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
