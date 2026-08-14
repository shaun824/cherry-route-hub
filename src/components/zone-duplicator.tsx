// Duplication controls for a drawn village area: copy it once, stamp out a row
// or a grid of identical footprints, rotate it, or match another area's size.
import { useState } from "react";
import { Copy, Grid3x3, RotateCcw, RotateCw, Rows3 } from "lucide-react";
import {
  duplicateZoneGrid,
  duplicateZoneLine,
  nextZoneName,
  resizeZone,
  rotateZone,
  translateZone,
  zoneSizeM,
  type DuplicateDirection,
  type VillageZone,
} from "@/lib/village-zones";

const DIRECTIONS: { id: DuplicateDirection; label: string }[] = [
  { id: "east", label: "Right (east)" },
  { id: "west", label: "Left (west)" },
  { id: "north", label: "Up (north)" },
  { id: "south", label: "Down (south)" },
];

export default function ZoneDuplicator({
  zone,
  zones,
  onAdd,
  onUpdate,
}: {
  zone: VillageZone;
  zones: VillageZone[];
  /** Append new copies and select the first one. */
  onAdd: (copies: VillageZone[]) => void;
  onUpdate: (next: Partial<VillageZone>) => void;
}) {
  const [mode, setMode] = useState<"row" | "grid" | null>(null);
  const [count, setCount] = useState(4);
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(3);
  const [gap, setGap] = useState(2);
  const [dir, setDir] = useState<DuplicateDirection>("east");

  const taken = zones.map((z) => z.name);
  const size = zoneSizeM(zone);
  const others = zones.filter((z) => z.id !== zone.id);

  function stopper(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div className="mt-3 border-t border-border pt-3" onClick={stopper}>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() =>
            onAdd([
              {
                ...translateZone(zone, size.w + 2, 0),
                id: crypto.randomUUID(),
                name: nextZoneName(zone.name, taken),
              },
            ])
          }
          className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-bold text-white"
        >
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </button>
        <button
          onClick={() => setMode(mode === "row" ? null : "row")}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
            mode === "row" ? "cherry-gradient text-white" : "bg-muted text-ink"
          }`}
        >
          <Rows3 className="h-3.5 w-3.5" /> Row of copies
        </button>
        <button
          onClick={() => setMode(mode === "grid" ? null : "grid")}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
            mode === "grid" ? "cherry-gradient text-white" : "bg-muted text-ink"
          }`}
        >
          <Grid3x3 className="h-3.5 w-3.5" /> Grid of copies
        </button>
        <button
          onClick={() => onUpdate(rotateZone(zone, -15))}
          className="grid h-8 w-8 place-items-center rounded-lg bg-muted"
          aria-label="Rotate 15° anticlockwise"
        >
          <RotateCcw className="h-3.5 w-3.5 text-ink-soft" />
        </button>
        <button
          onClick={() => onUpdate(rotateZone(zone, 15))}
          className="grid h-8 w-8 place-items-center rounded-lg bg-muted"
          aria-label="Rotate 15° clockwise"
        >
          <RotateCw className="h-3.5 w-3.5 text-ink-soft" />
        </button>
      </div>

      {others.length > 0 ? (
        <label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-ink-soft">
          Match size of
          <select
            value=""
            onChange={(e) => {
              const src = others.find((o) => o.id === e.target.value);
              if (!src) return;
              const s = zoneSizeM(src);
              onUpdate(resizeZone(zone, s.w, s.h));
            }}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px]"
          >
            <option value="">Choose an area…</option>
            {others.map((o) => {
              const s = zoneSizeM(o);
              return (
                <option key={o.id} value={o.id}>
                  {o.name} · {Math.round(s.w)} × {Math.round(s.h)} m
                </option>
              );
            })}
          </select>
        </label>
      ) : null}

      {mode ? (
        <div className="mt-2 rounded-xl bg-muted/60 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {mode === "row" ? (
              <>
                <label className="text-[11px] font-semibold text-ink-soft">
                  How many copies
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-[11px] font-semibold text-ink-soft">
                  Direction
                  <select
                    value={dir}
                    onChange={(e) => setDir(e.target.value as DuplicateDirection)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    {DIRECTIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="text-[11px] font-semibold text-ink-soft">
                  Columns (across)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={cols}
                    onChange={(e) => setCols(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-[11px] font-semibold text-ink-soft">
                  Rows (down)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={rows}
                    onChange={(e) => setRows(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
              </>
            )}
            <label className="text-[11px] font-semibold text-ink-soft">
              Gap between (m)
              <input
                type="number"
                step="0.5"
                min={0}
                value={gap}
                onChange={(e) => setGap(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => {
                const copies =
                  mode === "row"
                    ? duplicateZoneLine(zone, Math.max(1, count), Math.max(0, gap), dir, taken)
                    : duplicateZoneGrid(
                        zone,
                        Math.max(1, cols),
                        Math.max(1, rows),
                        Math.max(0, gap),
                        taken,
                      );
                if (copies.length > 0) onAdd(copies);
                setMode(null);
              }}
              className="rounded-lg cherry-gradient px-3 py-1.5 text-[11px] font-bold text-white"
            >
              {mode === "row"
                ? `Create ${Math.max(1, count)} copies`
                : `Create ${Math.max(0, Math.max(1, cols) * Math.max(1, rows) - 1)} copies`}
            </button>
            <button
              onClick={() => setMode(null)}
              className="rounded-lg bg-background px-3 py-1.5 text-[11px] font-bold text-ink-soft ring-1 ring-border"
            >
              Cancel
            </button>
            <span className="text-[11px] text-ink-soft">
              Each copy is exactly {Math.round(size.w)} × {Math.round(size.h)} m
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
