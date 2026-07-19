import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { currentRider, events, formatDate, formatTime, getEntryConfig, type EntryCategory, type MerchItem } from "@/lib/mock-data";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";

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
  useHydratedStore();
  const loader = Route.useLoaderData();
  const waivers = useAdminStore((s) => s.settings.waivers);
  const storeEvent = useAdminStore((s) => s.events.find((e) => e.id === loader.event.id));
  const event = storeEvent ?? loader.event;
  const config = loader.config;

  // Admin-managed classes override the default config; same for batches.
  const classes = (event.classes && event.classes.length > 0 ? event.classes : config.categories) as EntryCategory[];
  const batches = event.batches ?? [];


  const [categoryId, setCategoryId] = useState(classes[0]?.id ?? "");
  const [batchId, setBatchId] = useState<string>(batches[0]?.id ?? "");
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

  type Friend = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dob: string;
    categoryId: string;
    batchId: string;
    tshirtSize: string;
    jacketSize: string;
  };
  const makeFriend = (): Friend => ({
    id: `f_${Math.random().toString(36).slice(2, 9)}`,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    categoryId: classes[0]?.id ?? "",
    batchId: batches[0]?.id ?? "",
    tshirtSize: "",
    jacketSize: "",
  });
  const [friends, setFriends] = useState<Friend[]>([]);
  const updateFriend = (id: string, patch: Partial<Friend>) =>
    setFriends((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFriend = (id: string) => setFriends((fs) => fs.filter((f) => f.id !== id));

  const [waiver, setWaiver] = useState(false);
  const [terms, setTerms] = useState(false);
  type Stage = "form" | "pay" | "success";
  const [stage, setStage] = useState<Stage>("form");
  const [paymentId, setPaymentId] = useState<string>("");

  const category = classes.find((c) => c.id === categoryId) ?? classes[0];
  const batch = batches.find((b) => b.id === batchId);

  const merchTotal = useMemo(
    () =>
      config.merch.reduce((sum: number, m: MerchItem) => sum + (merchQty[m.id] ?? 0) * m.priceZAR, 0),
    [merchQty, config.merch],
  );
  const friendsTotal = useMemo(
    () =>
      friends.reduce((sum, f) => {
        const c = classes.find((cc) => cc.id === f.categoryId);
        return sum + (c?.priceZAR ?? 0);
      }, 0),
    [friends, classes],
  );
  const total = (category?.priceZAR ?? 0) + friendsTotal + merchTotal;

  const setQty = (id: string, delta: number) =>
    setMerchQty((q) => {
      const next = Math.max(0, Math.min(9, (q[id] ?? 0) + delta));
      return { ...q, [id]: next };
    });

  const kitRequired =
    (config.jacketIncluded && !jacketSize) || (config.tshirtIncluded && !tshirtSize);

  const missingMerchSize = config.merch.some((m: MerchItem) => (merchQty[m.id] ?? 0) > 0 && m.sizes && !merchSize[m.id],
  );

  const batchRequired = batches.length > 0 && !batchId;

  const friendsInvalid = friends.some(
    (f) =>
      !f.firstName ||
      !f.lastName ||
      !f.email ||
      !f.phone ||
      !f.dob ||
      (batches.length > 0 && !f.batchId) ||
      (config.jacketIncluded && !f.jacketSize) ||
      (config.tshirtIncluded && !f.tshirtSize),
  );

  const canSubmit =
    !!category && firstName && lastName && email && phone && emergencyName && emergencyPhone && waiver && terms && !kitRequired && !missingMerchSize && !batchRequired && !friendsInvalid;

  if (stage === "success") {
    return (
      <div className="min-h-[80vh] px-5 pt-14">
        <div className="mx-auto max-w-md rounded-3xl bg-card p-6 text-center ring-1 ring-border">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100">
            <Check className="h-7 w-7 text-emerald-700" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-ink">Payment successful</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {friends.length > 0 ? (
              <>You and <strong>{friends.length}</strong> friend{friends.length === 1 ? "" : "s"} are in for <strong>{event.name}</strong>.</>
            ) : (
              <>You're in for <strong>{event.name}</strong> — {category.label}.</>
            )}
          </p>
          <div className="mt-4 rounded-2xl bg-accent/40 p-4 text-left text-xs text-ink">
            <p className="flex justify-between"><span>Your entry ({category.distanceKm} km)</span><strong>{ZAR(category.priceZAR)}</strong></p>
            {friendsTotal > 0 && (
              <p className="mt-1 flex justify-between"><span>{friends.length} friend entr{friends.length === 1 ? "y" : "ies"}</span><strong>{ZAR(friendsTotal)}</strong></p>
            )}
            {merchTotal > 0 && (
              <p className="mt-1 flex justify-between"><span>Merchandise</span><strong>{ZAR(merchTotal)}</strong></p>
            )}
            <div className="my-2 border-t border-border" />
            <p className="flex justify-between text-sm"><span className="font-bold">Total paid</span><strong className="text-cherry">{ZAR(total)}</strong></p>
            <p className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Payment ref</span><span className="font-mono">{paymentId}</span>
            </p>
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-widest text-muted-foreground">
            Receipt sent to {email}
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
          if (canSubmit) setStage("pay");
        }}
      >
        {/* Category */}
        <Section title="1 · Choose your category" hint="Distance and pricing">
          <div className="space-y-2">
            {config.categories.map((c: EntryCategory) => {
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

        {/* Friends / group entry */}
        <Section
          title="Enter friends with you"
          hint="Add friends to this order — one entry per person, one payment"
          right={
            <span className="rounded-full bg-cherry/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cherry">
              Optional
            </span>
          }
        >
          <div className="space-y-3">
            {friends.map((f, i) => {
              const fCat = config.categories.find((c: EntryCategory) => c.id === f.categoryId);
              return (
                <div key={f.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-cherry">
                      Friend {i + 1}
                      {f.firstName ? ` · ${f.firstName}` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeFriend(f.id)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-cherry"
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="First name" compact value={f.firstName} onChange={(v) => updateFriend(f.id, { firstName: v })} required />
                    <Field label="Last name" compact value={f.lastName} onChange={(v) => updateFriend(f.id, { lastName: v })} required />
                    <Field label="Email" type="email" compact value={f.email} onChange={(v) => updateFriend(f.id, { email: v })} required className="col-span-2" />
                    <Field label="Mobile" type="tel" compact value={f.phone} onChange={(v) => updateFriend(f.id, { phone: v })} required />
                    <Field label="Date of birth" type="date" compact value={f.dob} onChange={(v) => updateFriend(f.id, { dob: v })} required />
                  </div>

                  <label className="mt-2 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Category <span className="text-cherry">*</span>
                    </span>
                    <select
                      value={f.categoryId}
                      onChange={(e) => updateFriend(f.id, { categoryId: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-ink focus:border-cherry focus:outline-none"
                    >
                      {config.categories.map((c: EntryCategory) => (
                        <option key={c.id} value={c.id}>
                          {c.label} · {c.distanceKm} km · {ZAR(c.priceZAR)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {(config.jacketIncluded || config.tshirtIncluded) && (
                    <div className="mt-3 space-y-3">
                      {config.jacketIncluded && (
                        <SizePicker
                          label="Race jacket"
                          emoji="🧥"
                          sizes={config.jacketSizes}
                          value={f.jacketSize}
                          onChange={(v) => updateFriend(f.id, { jacketSize: v })}
                          required
                        />
                      )}
                      {config.tshirtIncluded && (
                        <SizePicker
                          label="Event T-shirt"
                          emoji="👕"
                          sizes={config.tshirtSizes}
                          value={f.tshirtSize}
                          onChange={(v) => updateFriend(f.id, { tshirtSize: v })}
                          required
                        />
                      )}
                    </div>
                  )}

                  {fCat && (
                    <p className="mt-2 flex justify-between text-xs">
                      <span className="text-ink-soft">Entry fee</span>
                      <span className="font-mono font-bold text-cherry">{ZAR(fCat.priceZAR)}</span>
                    </p>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setFriends((fs) => [...fs, makeFriend()])}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cherry/40 bg-cherry/5 py-3 text-sm font-bold text-cherry hover:bg-cherry/10"
            >
              <Plus className="h-4 w-4" /> Add a friend
            </button>
            {friends.length > 0 && (
              <p className="text-[11px] text-ink-soft">
                Each friend gets their own entry, kit and race number. You'll pay for everyone in one checkout.
              </p>
            )}
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
            {config.merch.map((m: MerchItem) => {
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
                        {m.sizes.map((s: string) => (
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
          <div className="space-y-3">
            <div>
              <Check_ box={waiver} onChange={setWaiver}>
                {waivers.waiverText}
              </Check_>
              {waivers.waiverFullText ? (
                <p className="mt-1.5 ml-8 text-[11px] leading-relaxed text-ink-soft">
                  {waivers.waiverFullText}
                </p>
              ) : null}
            </div>
            <div>
              <Check_ box={terms} onChange={setTerms}>
                {waivers.termsText}
              </Check_>
              {waivers.termsFullText ? (
                <p className="mt-1.5 ml-8 text-[11px] leading-relaxed text-ink-soft">
                  {waivers.termsFullText}
                </p>
              ) : null}
            </div>
          </div>
        </Section>


        {/* Order summary */}
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Order summary
          </p>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">Entry — {category.label} ({firstName || "You"})</span>
              <span className="font-mono font-semibold text-ink">{ZAR(category.priceZAR)}</span>
            </div>
            {friends.map((f, i) => {
              const fc = config.categories.find((c: EntryCategory) => c.id === f.categoryId);
              if (!fc) return null;
              return (
                <div key={f.id} className="flex justify-between">
                  <span className="text-ink-soft">
                    Entry — {fc.label} ({f.firstName || `Friend ${i + 1}`})
                  </span>
                  <span className="font-mono font-semibold text-ink">{ZAR(fc.priceZAR)}</span>
                </div>
              );
            })}
            {config.merch.map((m: MerchItem) => {
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
          onClick={() => canSubmit && setStage("pay")}
          className="flex w-full items-center justify-center gap-2 rounded-xl cherry-gradient py-3.5 text-sm font-bold text-white shadow-lg shadow-cherry/25 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99] transition-transform"
        >
          Continue to payment · {ZAR(total)}
          <ChevronRight className="h-4 w-4" />
        </button>
        {!canSubmit && (
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            {kitRequired
              ? "Choose your included kit sizes to continue"
              : missingMerchSize
              ? "Pick a size for each merch item you've added"
              : friendsInvalid
              ? "Complete every friend's details and sizes"
              : "Fill your details and accept the waivers"}
          </p>
        )}
      </div>

      {stage === "pay" && (
        <PaymentSheet
          amount={total}
          email={email}
          name={`${firstName} ${lastName}`.trim()}
          onCancel={() => setStage("form")}
          onSuccess={(id) => {
            setPaymentId(id);
            setStage("success");
          }}
        />
      )}
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

/* ── Mock Stripe-style checkout sheet ─────────────────────────────── */

function PaymentSheet({
  amount,
  email,
  name,
  onCancel,
  onSuccess,
}: {
  amount: number;
  email: string;
  name: string;
  onCancel: () => void;
  onSuccess: (paymentId: string) => void;
}) {
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12 / 28");
  const [cvc, setCvc] = useState("123");
  const [holder, setHolder] = useState(name || "");
  const [postal, setPostal] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "declined">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const digits = card.replace(/\D/g, "");
  const brand =
    digits.startsWith("4") ? "Visa" :
    digits.startsWith("5") ? "Mastercard" :
    digits.startsWith("3") ? "Amex" : "Card";

  const cardValid = digits.length >= 15 && digits.length <= 19;
  const expValid = /^\d{2}\s*\/\s*\d{2}$/.test(exp);
  const cvcValid = /^\d{3,4}$/.test(cvc);
  const ready = cardValid && expValid && cvcValid && holder.trim().length > 1 && postal.trim().length > 0;

  const formatCard = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 19);
    return d.replace(/(.{4})/g, "$1 ").trim();
  };
  const formatExp = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)} / ${d.slice(2)}`;
  };

  const submit = async () => {
    if (!ready || status === "processing") return;
    setStatus("processing");
    setErrorMsg("");

    // Simulate a Stripe /confirm round-trip
    await new Promise((r) => setTimeout(r, 1600));

    // Stripe's classic test decline card
    if (digits === "4000000000000002") {
      setStatus("declined");
      setErrorMsg("Your card was declined. (test card 4000 0000 0000 0002)");
      return;
    }
    if (digits === "4000000000009995") {
      setStatus("declined");
      setErrorMsg("Insufficient funds. Try a different card.");
      return;
    }

    const paymentId = `pi_mock_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    onSuccess(paymentId);
  };

  const processing = status === "processing";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Payment"
    >
      <div
        className="relative w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl ring-1 ring-border sm:rounded-3xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <button
          type="button"
          onClick={processing ? undefined : onCancel}
          disabled={processing}
          aria-label="Close payment"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-accent/60 text-ink hover:bg-accent disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#635BFF] text-white">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Secure checkout
            </p>
            <p className="text-sm font-semibold text-ink">Red Cherry Events</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-accent/40 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-ink-soft">Amount due</span>
            <span className="font-mono text-xl font-bold text-cherry">
              {new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount)}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{email}</p>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Card number
            </span>
            <div className="relative">
              <input
                inputMode="numeric"
                autoComplete="cc-number"
                value={card}
                disabled={processing}
                onChange={(e) => setCard(formatCard(e.target.value))}
                placeholder="1234 1234 1234 1234"
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 pr-16 font-mono text-sm text-ink focus:border-cherry focus:outline-none disabled:opacity-60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-soft">
                {brand}
              </span>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Expiry
              </span>
              <input
                inputMode="numeric"
                autoComplete="cc-exp"
                value={exp}
                disabled={processing}
                onChange={(e) => setExp(formatExp(e.target.value))}
                placeholder="MM / YY"
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-sm text-ink focus:border-cherry focus:outline-none disabled:opacity-60"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                CVC
              </span>
              <input
                inputMode="numeric"
                autoComplete="cc-csc"
                value={cvc}
                disabled={processing}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-sm text-ink focus:border-cherry focus:outline-none disabled:opacity-60"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Cardholder name
            </span>
            <input
              autoComplete="cc-name"
              value={holder}
              disabled={processing}
              onChange={(e) => setHolder(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-ink focus:border-cherry focus:outline-none disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Postal code
            </span>
            <input
              autoComplete="postal-code"
              value={postal}
              disabled={processing}
              onChange={(e) => setPostal(e.target.value)}
              placeholder="8000"
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-ink focus:border-cherry focus:outline-none disabled:opacity-60"
            />
          </label>
        </div>

        {status === "declined" && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-cherry/40 bg-cherry/5 p-3 text-xs text-cherry-deep"
          >
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!ready || processing}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl cherry-gradient py-3.5 text-sm font-bold text-white shadow-lg shadow-cherry/25 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99] transition-transform"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing payment…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Pay {new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount)}
            </>
          )}
        </button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-3 w-3" /> Test mode · powered by Stripe (mock)
        </p>
        <p className="mt-1 text-center text-[10px] text-muted-foreground">
          Use <span className="font-mono">4242 4242 4242 4242</span> to succeed, <span className="font-mono">4000 0000 0000 0002</span> to fail.
        </p>
      </div>
    </div>
  );
}
