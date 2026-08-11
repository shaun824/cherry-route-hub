import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Package, RefreshCw } from "lucide-react";
import {
  deleteMerchItem,
  listMerchCatalog,
  syncMerchCatalog,
  upsertMerchItem,
} from "@/lib/merch-catalog.functions";

export const Route = createFileRoute("/admin/merchandise")({
  component: MerchandisePage,
});

function MerchandisePage() {
  const listFn = useServerFn(listMerchCatalog);
  const syncFn = useServerFn(syncMerchCatalog);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const autoPulled = useRef(false);

  const catalog = useQuery({
    queryKey: ["merch-catalog"],
    queryFn: () => listFn({}),
    staleTime: 30_000,
  });

  async function runSync(eventId?: string) {
    setBusy(eventId ?? "all");
    setError(null);
    setNote(null);
    try {
      const res = await syncFn({ data: eventId ? { eventId } : {} });
      setNote(`Pulled ${res.items} merchandise options across ${res.events} event(s).`);
      if (res.errors.length) setError(res.errors.join(" · "));
      await catalog.refetch();
    } catch (err) {
      setError((err as Error).message ?? "Sync failed");
    } finally {
      setBusy(null);
    }
  }

  // Pull the live catalogue straight away the first time the page opens.
  useEffect(() => {
    if (autoPulled.current || !catalog.data) return;
    autoPulled.current = true;
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    const stale = catalog.data.some(
      (e) =>
        e.entryNinjaId &&
        (e.items.length === 0 || !e.syncedAt || new Date(e.syncedAt).getTime() < cutoff),
    );
    if (stale) void runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.data]);

  const events = catalog.data ?? [];

  return (
    <div className="flex-1 space-y-5 pb-24 md:pb-0">
      <header className="space-y-1">
        <h1 className="font-display text-xl font-bold">Merchandise options</h1>
        <p className="text-sm text-ink-soft">
          Every add-on that can be attached to a rider's profile, pulled live from Entry Ninja per
          event. When an event is assigned to a rider, these are the options the app knows about.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs text-ink-soft">
        <Package className="h-4 w-4 text-cherry" />
        Catalogue synced from api.entryninja.com
        <button
          onClick={() => void runSync()}
          disabled={busy !== null}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-semibold text-ink disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy === "all" ? "animate-spin" : ""}`} /> Pull all events
        </button>
      </div>

      {note && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {note}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {catalog.isLoading && <p className="text-sm text-ink-soft">Loading catalogue…</p>}

      <div className="space-y-4">
        {events.map((ev) => (
          <section key={ev.eventId} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-ink">{ev.eventName}</h2>
                <p className="text-xs text-ink-soft">
                  {ev.entryNinjaId ? `Entry Ninja #${ev.entryNinjaId}` : "Not linked to Entry Ninja"}
                  {ev.syncedAt ? ` · updated ${new Date(ev.syncedAt).toLocaleString()}` : ""}
                </p>
              </div>
              {ev.entryNinjaId && (
                <button
                  onClick={() => void runSync(ev.eventId)}
                  disabled={busy !== null}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${busy === ev.eventId ? "animate-spin" : ""}`} />
                  Pull now
                </button>
              )}
            </div>

            {ev.items.length === 0 && (
              <p className="mt-3 text-sm text-ink-soft">
                {ev.entryNinjaId
                  ? "No merchandise options configured on this event yet."
                  : "Link this event to Entry Ninja to pull its merchandise."}
              </p>
            )}

            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {ev.items.map((item) => (
                <MerchItemCard
                  key={item.id}
                  eventId={ev.eventId}
                  item={item}
                  onChanged={() => void catalog.refetch()}
                  onError={setError}
                />
              ))}
              <MerchItemCard
                key={`new-${ev.eventId}`}
                eventId={ev.eventId}
                onChanged={() => void catalog.refetch()}
                onError={setError}
              />
            </ul>

          </section>
        ))}
      </div>
    </div>
  );
}

type Item = { id: string; name: string; enItemId: number | null; options: { name: string; price?: number | null }[] };

function MerchItemCard({
  eventId,
  item,
  onChanged,
  onError,
}: {
  eventId: string;
  item?: Item;
  onChanged: () => void;
  onError: (msg: string | null) => void;
}) {
  const upsertFn = useServerFn(upsertMerchItem);
  const deleteFn = useServerFn(deleteMerchItem);
  const [editing, setEditing] = useState(!item);
  const [name, setName] = useState(item?.name ?? "");
  const [options, setOptions] = useState((item?.options ?? []).map((o) => o.name).join(", "));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    onError(null);
    try {
      await upsertFn({
        data: {
          ...(item ? { id: item.id } : {}),
          eventId,
          name: name.trim(),
          options: options.split(",").map((o) => o.trim()).filter(Boolean),
        },
      });
      if (!item) {
        setName("");
        setOptions("");
      } else {
        setEditing(false);
      }
      onChanged();
    } catch (err) {
      onError((err as Error).message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    setSaving(true);
    try {
      await deleteFn({ data: { id: item.id } });
      onChanged();
    } catch (err) {
      onError((err as Error).message ?? "Could not delete");
    } finally {
      setSaving(false);
    }
  }

  if (!editing && item) {
    return (
      <li className="rounded-xl border border-border/70 bg-background p-3">
        <div className="flex items-start gap-2">
          <p className="text-sm font-semibold text-ink">{item.name}</p>
          <button
            onClick={() => setEditing(true)}
            className="ml-auto text-xs font-semibold text-cherry"
          >
            Edit
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.options.length === 0 && <span className="text-xs text-ink-soft">No options listed</span>}
          {item.options.map((o, i) => (
            <span key={`${item.id}-${i}`} className="rounded-full bg-muted px-2.5 py-1 text-xs text-ink">
              {o.name}
              {o.price ? ` · R${o.price}` : ""}
            </span>
          ))}
        </div>
      </li>
    );
  }

  return (
    <li className="space-y-2 rounded-xl border border-dashed border-border bg-background p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={item ? "Item name" : "Add an option (e.g. Tent rental)"}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
      />
      <input
        value={options}
        onChange={(e) => setOptions(e.target.value)}
        placeholder="Choices, comma separated — e.g. Small, Medium, Large"
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => void save()}
          disabled={saving || !name.trim()}
          className="rounded-lg bg-cherry px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {item ? "Save" : "Add option"}
        </button>
        {item && (
          <>
            <button onClick={() => setEditing(false)} className="text-xs font-semibold text-ink-soft">
              Cancel
            </button>
            <button onClick={() => void remove()} className="ml-auto text-xs font-semibold text-destructive">
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
