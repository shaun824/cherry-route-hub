import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Minus,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { currentRider, events, formatDate, formatTime, getEntryConfig } from "@/lib/mock-data";

export const Route = createFileRoute("/events/$eventId/enter")({
  loader: ({ params }) => {
    const event = events.find((e) => e.id === params.eventId);
    const config = getEntryConfig(params.eventId);
    if (!event || !config) throw notFound();
    return { event, config };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Enter ${loaderData.event.name} — Red Cherry Events`
          : "Enter event — Red Cherry Events",
      },
      {
        name: "description",
        content: "Complete your event entry, choose your kit sizes and add merchandise.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EnterEvent,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p className="text-ink">Entries for this event aren't open here yet.</p>
      <Link to="/events" className="mt-4 inline-block text-cherry font-semibold">
        Back to events
      </Link>
    </div>
  ),
});

const ZAR = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);

function EnterEvent() {
  const { event, config } = Route.useLoaderData();

  const [categoryId, setCategoryId] = useState(config.categories[0].id);
  const [firstName, setFirstName] = useState(currentRider.name.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(currentRider.name.split(" ").slice(1).join(" ") ?? "");
  const [email, setEmail] = useState("alex@example.com");
  const [phone, setPhone] = useState("+27 82 000 0000");
  const [dob, setDob] = useState("1992-04-11");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [medical, setMedical] = useState("");
  const [licence, setLicence] = useState("");
  const [club, setClub] = useState("");

  const [jacketSize, setJacketSize] = useState<string>("");
  const [tshirtSize, setTshirtSize] = useState<string>("");

  const [merchQty, setMerchQty] = useState<Record<string, number>>({});
  const [merchSize, setMerchSize] = useState<Record<string, string>>({});

  const [waiver, setWaiver] = useState(false);
  const [terms, setTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const category = config.categories.find((c) => c.id === categoryId)!;

  const merchTotal = useMemo(
    () =>
      config.merch.reduce((sum, m) => sum + (merchQty[m.id] ?? 0) * m.priceZAR, 0),
    [merchQty, config.merch],
  );
  const total = category.priceZAR + merchTotal;

  const setQty = (id: string, delta: number) =>
    setMerchQty((q) => {
      const next = Math.max(0, Math.min(9, (q[id] ?? 0) + delta));
      return { ...q, [id]: next };
    });

  const kitRequired =
    (config.jacketIncluded && !jacketSize) || (config.tshirtIncluded && !tshirtSize);

  const missingMerchSize = config.merch.some(
    (m) => (merchQty[m.id] ?? 0) > 0 && m.sizes && !merchSize[m.id],
  );

  const canSubmit =
    firstName && lastName && email && phone && emergencyName && emergencyPhone && waiver && terms && !kitRequired && !missingMerchSize;

  if (submitted) {
    return (
      <div className="min-h-[80vh] px-5 pt-14">
        <div className="mx-auto max-w-md rounded-3xl bg-card p-6 text-center ring-1 ring-border">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100">
            <Check className="h-7 w-7 text-emerald-700" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-ink">Entry confirmed</h1>
          <p className="mt-1 text-sm text-ink-soft">
            You're in for <strong>{event.name}</strong> — {category.label}.
          </p>
          <div className="mt-4 rounded-2xl bg-accent/40 p-4 text-left text-xs text-ink">
            <p className="flex justify-between"><span>Entry ({category.distanceKm} km)</span><strong>{ZAR(category.priceZAR)}</strong></p>
            {merchTotal > 0 && (
              <p className="mt-1 flex justify-between"><span>Merchandise</span><strong>{ZAR(merchTotal)}</strong></p>
            )}
            <div className="my-2 border-t border-border" />
            <p className="flex justify-between text-sm"><span className="font-bold">Total paid</span><strong className="text-cherry">{ZAR(total)}</strong></p>
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-widest text-muted-foreground">
            Confirmation sent to {email}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              to="/events/$eventId"
              params={{ eventId: event.id }}
              className="rounded-xl cherry-gradient py-3 text-sm font-bold text-white"
            >
              Back to event
            </Link>
            <Link to="/events" className="text-xs font-semibold text-muted-foreground">
              Browse more events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div
        className={`relative bg-gradient-to-br ${event.heroColor} px-5 pb-5 text-white`}
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)" }}
      >
        <Link
          to="/events/$eventId"
          params={{ eventId: event.id }}
          aria-label="Back"
          className="absolute left-4 grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
          Event entry
        </p>
        <h1 className="mt-1 font-display text-xl font-bold leading-tight">{event.name}</h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-90">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDate(event.date)} · {formatTime(event.date)}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>
          <span className="flex items-center gap-1"><RouteIcon className="h-3.5 w-3.5" />{event.distanceKm} km</span>
        </div>
        <p className="mt-3 text-[11px] opacity-85">
          Entries close {formatDate(config.cutOff)} · via Entry Ninja
        </p>
      </div>

      <form
        className="space-y-6 px-5 pt-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) setSubmitted(true);
        }}
      >
        {/* Category */}
        <Section title="1 · Choose your category" hint="Distance and pricing">
          <div className="space-y-2">
            {config.categories.map((c) => {
              const active = c.id === categoryId;
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                    active
                      ? "border-cherry bg-cherry/5 ring-2 ring-cherry/30"
                      : "border-border bg-card hover:border-cherry/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    className="sr-only"
                    checked={active}
                    onChange={() => setCategoryId(c.id)}
                  />
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                      active ? "border-cherry bg-cherry" : "border-border"
                    }`}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-ink">{c.label}</p>
                      <p className="font-mono text-sm font-bold text-cherry">{ZAR(c.priceZAR)}</p>
                    </div>
                    <p className="mt-0.5 text-[11px] uppercase tracking-widest text-muted-foreground">
                      {c.distanceKm} km
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">{c.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </Section>

        {/* Rider details */}
        <Section title="2 · Rider details" hint="Matches your Entry Ninja profile">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" value={firstName} onChange={setFirstName} required />
            <Field label="Last name" value={lastName} onChange={setLastName} required />
            <Field label="Email" type="email" value={email} onChange={setEmail} required className="col-span-2" />
            <Field label="Mobile" type="tel" value={phone} onChange={setPhone} required />
            <Field label="Date of birth" type="date" value={dob} onChange={setDob} required />
            <Field label="Cycling licence #" value={licence} onChange={setLicence} placeholder="Optional" />
            <Field label="Club / team" value={club} onChange={setClub} placeholder="Optional" />
          </div>
          <div className="mt-3 rounded-xl bg-accent/40 p-3 text-[11px] text-ink-soft">
            <p className="font-semibold text-ink">Emergency contact</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Name" value={emergencyName} onChange={setEmergencyName} required compact />
              <Field label="Phone" type="tel" value={emergencyPhone} onChange={setEmergencyPhone} required compact />
            </div>
            <textarea
              value={medical}
              onChange={(e) => setMedical(e.target.value)}
              placeholder="Allergies, medications, medical conditions (optional)"
              rows={2}
              className="mt-2 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-xs text-ink placeholder:text-muted-foreground focus:border-cherry focus:outline-none"
            />
          </div>
        </Section>

        {/* Kit sizes */}
        {(config.jacketIncluded || config.tshirtIncluded) && (
          <Section
            title="3 · Included kit sizes"
            hint="Included with your entry — pick carefully, sizes can't be swapped after cut-off"
          >
            <div className="space-y-4">
              {config.jacketIncluded && (
                <SizePicker
                  label="Race jacket"
                  emoji="🧥"
                  sizes={config.jacketSizes}
                  value={jacketSize}
                  onChange={setJacketSize}
                  required
                />
              )}
              {config.tshirtIncluded && (
                <SizePicker
                  label="Event T-shirt"
                  emoji="👕"
                  sizes={config.tshirtSizes}
                  value={tshirtSize}
                  onChange={setTshirtSize}
                  required
                />
              )}
              <div className="rounded-lg bg-accent/40 p-2.5 text-[11px] text-ink-soft">
                <p><strong>Fit tip:</strong> Race jackets fit slim/aero. Size up for a relaxed fit.</p>
              </div>
            </div>
          </Section>
        )}

        {/* Merch */}
        <Section
          title={`${config.jacketIncluded || config.tshirtIncluded ? "4" : "3"} · Add merchandise`}
          hint="Collected at race village on the day"
          right={
            <span className="rounded-full bg-cherry/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cherry">
              Optional
            </span>
          }
        >
          <div className="space-y-2">
            {config.merch.map((m) => {
              const qty = merchQty[m.id] ?? 0;
              const active = qty > 0;
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border p-3 transition ${
                    active ? "border-cherry/60 bg-cherry/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent/60 text-2xl">
                      {m.image}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{m.name}</p>
                        <p className="font-mono text-sm font-bold text-cherry">{ZAR(m.priceZAR)}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-soft">{m.description}</p>
                      {m.limited && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-cherry px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                          <Sparkles className="h-2.5 w-2.5" /> Limited
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    {m.sizes ? (
                      <select
                        value={merchSize[m.id] ?? ""}
                        onChange={(e) => setMerchSize((s) => ({ ...s, [m.id]: e.target.value }))}
                        className={`flex-1 rounded-lg border bg-card px-2.5 py-2 text-xs font-semibold text-ink focus:outline-none ${
                          qty > 0 && !merchSize[m.id] ? "border-cherry" : "border-border"
                        }`}
                      >
                        <option value="">Select size…</option>
                        {m.sizes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="flex-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                        One size
                      </span>
                    )}
                    <QtyStepper qty={qty} onDec={() => setQty(m.id, -1)} onInc={() => setQty(m.id, 1)} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Waivers */}
        <Section title="Waivers & terms">
          <div className="space-y-2">
            <Check_ box={waiver} onChange={setWaiver}>
              I accept the indemnity & liability waiver for this event and confirm I'm medically fit to ride.
            </Check_>
            <Check_ box={terms} onChange={setTerms}>
              I agree to the Red Cherry Events terms and Entry Ninja processing of my data.
            </Check_>
          </div>
        </Section>

        {/* Order summary */}
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Order summary
          </p>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">Entry — {category.label}</span>
              <span className="font-mono font-semibold text-ink">{ZAR(category.priceZAR)}</span>
            </div>
            {config.merch.map((m) => {
              const q = merchQty[m.id] ?? 0;
              if (!q) return null;
              return (
                <div key={m.id} className="flex justify-between">
                  <span className="text-ink-soft">
                    {q} × {m.name}{merchSize[m.id] ? ` (${merchSize[m.id]})` : ""}
                  </span>
                  <span className="font-mono font-semibold text-ink">{ZAR(q * m.priceZAR)}</span>
                </div>
              );
            })}
            <div className="my-2 border-t border-border" />
            <div className="flex justify-between text-base">
              <span className="font-bold text-ink">Total</span>
              <span className="font-mono font-bold text-cherry">{ZAR(total)}</span>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Secure checkout via Entry Ninja
          </p>
        </div>
      </form>

      {/* Sticky submit */}
      <div
        className="sticky bottom-0 z-20 mt-6 border-t border-border bg-card/95 px-5 py-3 backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => canSubmit && setSubmitted(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl cherry-gradient py-3.5 text-sm font-bold text-white shadow-lg shadow-cherry/25 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99] transition-transform"
        >
          Confirm entry · {ZAR(total)}
          <ChevronRight className="h-4 w-4" />
        </button>
        {!canSubmit && (
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            {kitRequired
              ? "Choose your included kit sizes to continue"
              : missingMerchSize
              ? "Pick a size for each merch item you've added"
              : "Fill your details and accept the waivers"}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── local building blocks ─────────────────────────────────────────── */

function Section({
  title,
  hint,
  right,
  children,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-bold text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  className,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <label className={`flex flex-col ${className ?? ""}`}>
      <span className={`text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${compact ? "" : "mb-1"}`}>
        {label}{required && <span className="text-cherry"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink placeholder:text-muted-foreground focus:border-cherry focus:outline-none"
      />
    </label>
  );
}

function SizePicker({
  label,
  emoji,
  sizes,
  value,
  onChange,
  required,
}: {
  label: string;
  emoji: string;
  sizes: string[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-sm font-semibold text-ink">
          {label}{required && <span className="text-cherry"> *</span>}
        </span>
        {value && (
          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-800">
            {value}
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {sizes.map((s) => {
          const active = s === value;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`rounded-lg border py-2 text-xs font-bold transition ${
                active
                  ? "border-cherry bg-cherry text-white"
                  : "border-border bg-card text-ink hover:border-cherry/50"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QtyStepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={onInc}
        className="flex items-center gap-1 rounded-lg border border-cherry px-3 py-2 text-xs font-bold text-cherry hover:bg-cherry hover:text-white transition"
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-cherry bg-card p-1">
      <button
        type="button"
        onClick={onDec}
        aria-label="Decrease"
        className="grid h-7 w-7 place-items-center rounded-md text-cherry hover:bg-cherry/10"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-4 text-center font-mono text-sm font-bold text-ink">{qty}</span>
      <button
        type="button"
        onClick={onInc}
        aria-label="Increase"
        className="grid h-7 w-7 place-items-center rounded-md text-cherry hover:bg-cherry/10"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Check_({
  box,
  onChange,
  children,
}: {
  box: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3">
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition ${
          box ? "border-cherry bg-cherry" : "border-border"
        }`}
      >
        {box && <Check className="h-3 w-3 text-white" />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={box}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-xs text-ink-soft">{children}</span>
    </label>
  );
}
