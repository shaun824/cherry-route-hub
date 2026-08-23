import { Fuel } from "lucide-react";

/** Sea to Sea is the only event where we move rider fuel between overnight stops. */
export function isFuelCarryEvent(eventName?: string | null) {
  return /sea\s*(to|2)\s*sea/i.test(eventName ?? "");
}

export function FuelNotice({ eventName }: { eventName?: string | null }) {
  if (!isFuelCarryEvent(eventName)) return null;
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cherry/10 text-cherry-deep">
          <Fuel className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-ink">Fuel: we move it for you</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            Arrive with a <strong className="text-ink">full tank</strong> and hand us{" "}
            <strong className="text-ink">35 litres of fuel</strong> at registration. We transport your fuel to
            each overnight stop, so you refill from your own supply along the route.
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-ink-soft">
            <li>• Use sealed, clearly marked jerry cans with your name and race number.</li>
            <li>• 35 ℓ total (e.g. 2 × 20 ℓ part-filled, or 1 × 20 ℓ + 1 × 15 ℓ).</li>
            <li>• Drop cans at the fuel truck during registration — collect empties at the finish.</li>
            <li>• No fuel in luggage bags; cans travel separately for safety.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
