// Department home for crew: guided onboarding (role brief, safety, kit,
// contacts, waiver) the first time, then today's instructions and packing list.
import { createFileRoute, Link, Navigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  Phone,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useIsCrew } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CrewWaiverDialog } from "@/components/crew-waiver-dialog";
import {
  fetchMyWaiver,
  fetchPacking,
  fetchRunSheetTasks,
  groupTasksByDay,
  suggestPackingItem,
  type Department,
} from "@/lib/run-sheet";

export const Route = createFileRoute("/crew/department/$deptId")({
  head: () => ({
    meta: [
      { title: "Department brief · Red Cherry Crew" },
      {
        name: "description",
        content:
          "Department onboarding for Red Cherry event crew: role brief, safety notes, kit list, contacts and the day's instructions.",
      },
      { property: "og:title", content: "Department brief · Red Cherry Crew" },
      {
        property: "og:description",
        content: "Everything a new crew member needs to run their department on site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DepartmentPage,
});

const STEPS = ["Role brief", "Safety", "Kit list", "Contacts"] as const;

function DepartmentPage() {
  const { deptId } = useParams({ from: "/crew/department/$deptId" });
  const { isCrew, loading, user } = useIsCrew();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [showWaiver, setShowWaiver] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  const deptQ = useQuery({
    queryKey: ["crew-dept", deptId],
    enabled: isCrew && !!deptId,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_departments")
        .select("*, event:events(id, name, event_date, location)")
        .eq("id", deptId)
        .maybeSingle();
      return data as (Department & { event: { id: string; name: string; location: string } }) | null;
    },
  });
  const dept = deptQ.data;
  const eventId = dept?.event_id ?? "";

  const waiverQ = useQuery({
    queryKey: ["crew-waiver", eventId],
    enabled: isCrew && !!eventId,
    queryFn: () => fetchMyWaiver(eventId),
  });

  const waiverTextQ = useQuery({
    queryKey: ["crew-waiver-text"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "crew_waiver")
        .maybeSingle();
      const v = data?.value as { text?: string } | string | null;
      if (!v) return null;
      return typeof v === "string" ? v : (v.text ?? null);
    },
  });

  const packingQ = useQuery({
    queryKey: ["crew-packing", deptId],
    enabled: isCrew && !!deptId,
    queryFn: () => fetchPacking(deptId),
  });

  const tasksQ = useQuery({
    queryKey: ["crew-run-sheet", eventId],
    enabled: isCrew && !!eventId,
    queryFn: () => fetchRunSheetTasks(eventId),
  });

  const myTasks = useMemo(
    () => (tasksQ.data ?? []).filter((t) => t.department_id === deptId),
    [tasksQ.data, deptId],
  );
  const days = useMemo(() => groupTasksByDay(myTasks), [myTasks]);

  useEffect(() => {
    if (typeof window === "undefined" || !deptId) return;
    setOnboarded(window.localStorage.getItem(`rce:crew-onboard:${deptId}`) === "1");
  }, [deptId]);

  function finishOnboarding() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`rce:crew-onboard:${deptId}`, "1");
    }
    setOnboarded(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }
  if (!isCrew) return <Navigate to="/crew/login" />;
  if (deptQ.isLoading || onboarded === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }
  if (!dept) {
    return (
      <div className="p-4">
        <p className="text-sm text-ink-soft">That department isn't available.</p>
        <Link to="/crew" className="mt-3 inline-block text-sm font-semibold text-primary">
          Back to crew dashboard
        </Link>
      </div>
    );
  }

  const waiverSigned = !!waiverQ.data;
  const unlocked = onboarded && waiverSigned;
  const packing = packingQ.data ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <Link to="/crew" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <ArrowLeft className="h-4 w-4" /> Crew dashboard
      </Link>

      <header className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{dept.event?.name}</p>
        <h1 className="font-display text-2xl font-bold">{dept.name}</h1>
        {dept.lead_name ? (
          <p className="mt-1 text-sm text-ink-soft">
            Lead: {dept.lead_name}
            {dept.contact ? ` · ${dept.contact}` : ""}
          </p>
        ) : null}
      </header>

      {!unlocked ? (
        <section className="mt-5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Onboarding</h2>
            <span className="text-xs text-ink-soft">
              Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}
            </span>
          </div>
          <div className="mt-3 flex gap-1">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>

          <div className="mt-4 min-h-[9rem] text-sm leading-relaxed text-ink-soft">
            {step === 0 ? (
              <>
                <h3 className="mb-2 font-semibold text-foreground">What this department does</h3>
                <p className="whitespace-pre-line">
                  {dept.overview ||
                    "Your department lead will brief you on site. Work through the run sheet below for the detail of each day."}
                </p>
              </>
            ) : null}
            {step === 1 ? (
              <>
                <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                  <ShieldAlert className="h-4 w-4 text-primary" /> Safety and site rules
                </h3>
                <p className="whitespace-pre-line">
                  {dept.safety_notes ||
                    "Wear closed shoes and your crew shirt, keep hydrated, watch for vehicles in the village, and report every incident to your lead immediately."}
                </p>
              </>
            ) : null}
            {step === 2 ? (
              <>
                <h3 className="mb-2 font-semibold text-foreground">Kit to bring</h3>
                {packing.length ? (
                  <ul className="space-y-1">
                    {packing.map((p) => (
                      <li key={p.id} className="flex gap-2">
                        <span className={p.critical ? "text-primary" : "text-ink-soft"}>•</span>
                        <span>
                          <span className="text-foreground">{p.item}</span>
                          {p.qty ? ` × ${p.qty}` : ""}
                          {p.critical ? " (essential)" : ""}
                          {p.notes ? <span className="block text-xs">{p.notes}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No kit list loaded for this department yet.</p>
                )}
              </>
            ) : null}
            {step === 3 ? (
              <>
                <h3 className="mb-2 font-semibold text-foreground">Who to call</h3>
                <p className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> {dept.lead_name || "Department lead — ask at registration"}
                </p>
                {dept.contact ? (
                  <p className="mt-1 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <a className="text-primary" href={`tel:${dept.contact.replace(/\s/g, "")}`}>
                      {dept.contact}
                    </a>
                  </p>
                ) : null}
                {dept.event?.location ? (
                  <p className="mt-1 flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> {dept.event.location}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="mt-4 flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
              >
                Back
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  finishOnboarding();
                  if (!waiverSigned) setShowWaiver(true);
                }}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {waiverSigned ? "Open my instructions" : "Sign waiver and continue"}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {onboarded && !waiverSigned ? (
        <button
          type="button"
          onClick={() => setShowWaiver(true)}
          className="mt-4 w-full rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary"
        >
          Sign the crew waiver to unlock instructions
        </button>
      ) : null}

      {unlocked ? (
        <>
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-ink-soft">
              Waiver signed by {waiverQ.data?.full_name} ·{" "}
              {new Date(waiverQ.data?.accepted_at ?? Date.now()).toLocaleDateString()}
            </span>
          </div>

          <section className="mt-5">
            <h2 className="font-display text-lg font-bold">Instructions</h2>
            {days.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">
                No run sheet loaded for this department yet.
              </p>
            ) : null}
            {days.map((d) => (
              <div key={d.key} className="mt-3 rounded-2xl border border-border bg-card p-4">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide">{d.label}</h3>
                <ul className="mt-2 space-y-3">
                  {d.tasks.map((t) => (
                    <li key={t.id} className="border-l-2 border-primary/40 pl-3">
                      <p className="text-xs font-semibold text-primary">
                        {[t.start_time, t.end_time].filter(Boolean).join(" – ") || "Anytime"}
                      </p>
                      <p className="text-sm font-semibold">{t.task}</p>
                      {t.detail ? <p className="text-sm text-ink-soft">{t.detail}</p> : null}
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {[t.owner, t.location].filter(Boolean).join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Link
              to="/crew/run-sheet"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              <ClipboardList className="h-4 w-4" /> Open the full run sheet
            </Link>
          </section>

          <PackingPanel
            deptId={deptId}
            eventId={eventId}
            userId={user?.id ?? ""}
            userName={(user?.user_metadata?.full_name as string) ?? user?.email ?? ""}
            onSuggested={() => qc.invalidateQueries({ queryKey: ["crew-packing", deptId] })}
          />
        </>
      ) : null}

      {showWaiver && user ? (
        <CrewWaiverDialog
          userId={user.id}
          eventId={eventId}
          eventName={dept.event?.name ?? ""}
          departmentId={deptId}
          defaultName={(user.user_metadata?.full_name as string) ?? ""}
          waiverText={waiverTextQ.data}
          onAccepted={() => {
            setShowWaiver(false);
            waiverQ.refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function PackingPanel({
  deptId,
  eventId,
  userId,
  userName,
  onSuggested,
}: {
  deptId: string;
  eventId: string;
  userId: string;
  userName: string;
  onSuggested: () => void;
}) {
  const packingQ = useQuery({
    queryKey: ["crew-packing", deptId],
    queryFn: () => fetchPacking(deptId),
  });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [item, setItem] = useState("");
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(`rce:crew-pack:${deptId}`);
    if (raw) setChecked(JSON.parse(raw) as Record<string, boolean>);
  }, [deptId]);

  function toggle(id: string) {
    setChecked((c) => {
      const next = { ...c, [id]: !c[id] };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`rce:crew-pack:${deptId}`, JSON.stringify(next));
      }
      return next;
    });
  }

  async function submit() {
    if (!item.trim() || !userId) return;
    setBusy(true);
    try {
      await suggestPackingItem({ userId, userName, eventId, departmentId: deptId, item: item.trim(), notes });
      setItem("");
      setNotes("");
      setSent(true);
      onSuggested();
    } finally {
      setBusy(false);
    }
  }

  const items = packingQ.data ?? [];

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-display text-lg font-bold">Packing list</h2>
      <ul className="mt-3 space-y-2">
        {items.map((p) => (
          <li key={p.id}>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={!!checked[p.id]}
                onChange={() => toggle(p.id)}
                className="mt-1 h-4 w-4"
              />
              <span className={checked[p.id] ? "text-ink-soft line-through" : ""}>
                <span className="font-medium">{p.item}</span>
                {p.qty ? ` × ${p.qty}` : ""}
                {p.critical ? <span className="ml-2 text-xs font-semibold text-primary">essential</span> : null}
                {p.notes ? <span className="block text-xs text-ink-soft">{p.notes}</span> : null}
              </span>
            </label>
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm text-ink-soft">Nothing listed yet.</li> : null}
      </ul>

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Something missing? Suggest it
        </p>
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="e.g. second gazebo weight"
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why it's needed (optional)"
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!item.trim() || busy}
          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Send to the office
        </button>
        {sent ? (
          <p className="mt-2 text-xs text-primary">Thanks — an admin will review it before it's added.</p>
        ) : null}
      </div>
    </section>
  );
}
