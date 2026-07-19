import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Pin, PinOff, ArrowUp, ArrowDown, Clock } from "lucide-react";
import { useAdminStore, newId } from "@/lib/store";
import type { FeedPost } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/feed")({
  component: AdminFeed,
});

function blank(): FeedPost {
  return {
    id: newId("post"),
    externalId: null,
    type: "news",
    title: "",
    body: "",
    author: "Race Office",
    postedAt: new Date().toISOString(),
    pinned: false,
  };
}

const typeColors: Record<FeedPost["type"], string> = {
  news: "bg-secondary text-ink",
  notice: "bg-accent text-cherry-deep",
  weather: "bg-amber-100 text-amber-900",
  update: "bg-emerald-100 text-emerald-900",
};

type Filter = "all" | "live" | "scheduled" | "pinned";

function isScheduled(p: FeedPost, now: number) {
  return new Date(p.postedAt).getTime() > now;
}

// Sort key for admin view: pinned first, then by (order ?? +inf), then postedAt desc.
function adminSort(list: FeedPost[]) {
  return [...list].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (b.pinned && !a.pinned) return 1;
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });
}

function AdminFeed() {
  const feed = useAdminStore((s) => s.feed);
  const upsert = useAdminStore((s) => s.upsertPost);
  const del = useAdminStore((s) => s.deletePost);
  const [editing, setEditing] = useState<FeedPost | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const now = Date.now();
  const sorted = useMemo(() => adminSort(feed), [feed]);

  const counts = {
    all: feed.length,
    live: feed.filter((p) => !isScheduled(p, now)).length,
    scheduled: feed.filter((p) => isScheduled(p, now)).length,
    pinned: feed.filter((p) => p.pinned).length,
  };

  const shown = sorted.filter((p) => {
    if (filter === "all") return true;
    if (filter === "live") return !isScheduled(p, now);
    if (filter === "scheduled") return isScheduled(p, now);
    return !!p.pinned;
  });

  // Reorder: swap `order` with the previous/next post in the same pinned group.
  // Assigns numeric orders lazily so unmoved posts keep date-based sort.
  const reorder = (id: string, dir: -1 | 1) => {
    const group = sorted.filter((p) => !!p.pinned === !!sorted.find((x) => x.id === id)?.pinned);
    const i = group.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= group.length) return;
    // Assign explicit orders to whole group so swaps are deterministic.
    const withOrders = group.map((p, idx) => ({ ...p, order: (idx + 1) * 10 }));
    [withOrders[i].order, withOrders[j].order] = [withOrders[j].order!, withOrders[i].order!];
    for (const p of withOrders) upsert(p);
  };

  const togglePin = (p: FeedPost) => upsert({ ...p, pinned: !p.pinned });

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">News feed</h1>
          <p className="text-sm text-ink-soft">
            Create, schedule and reorder race notices, warnings and updates.
          </p>
        </div>
        <button
          onClick={() => setEditing(blank())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-2 text-sm font-semibold text-white shadow-sm"
        >
          <Plus className="h-4 w-4" /> New post
        </button>
      </header>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", "live", "scheduled", "pinned"] as Filter[]).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ring-1 ${
              filter === k
                ? "bg-cherry text-white ring-cherry"
                : "bg-card text-ink-soft ring-border hover:bg-secondary"
            }`}
          >
            {k} <span className="opacity-70">· {counts[k]}</span>
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {shown.map((p, idx) => {
          const scheduled = isScheduled(p, now);
          const canMoveUp = idx > 0 && shown[idx - 1].pinned === p.pinned;
          const canMoveDown = idx < shown.length - 1 && shown[idx + 1].pinned === p.pinned;
          return (
            <li
              key={p.id}
              className="flex items-start justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-border"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeColors[p.type]}`}
                  >
                    {p.type}
                  </span>
                  {p.pinned ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-cherry px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      <Pin className="h-3 w-3" /> pinned
                    </span>
                  ) : null}
                  {scheduled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-900">
                      <Clock className="h-3 w-3" /> scheduled
                    </span>
                  ) : null}
                  <span className="text-[11px] text-ink-soft">
                    {new Date(p.postedAt).toLocaleString()} · {p.author}
                  </span>
                </div>
                <p className="font-semibold text-ink">{p.title || "(untitled)"}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{p.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="flex flex-col">
                  <button
                    onClick={() => reorder(p.id, -1)}
                    disabled={!canMoveUp || filter !== "all"}
                    className="rounded-md p-1 text-ink-soft hover:bg-secondary disabled:opacity-30"
                    aria-label="Move up"
                    title={filter !== "all" ? "Switch to All to reorder" : "Move up"}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => reorder(p.id, 1)}
                    disabled={!canMoveDown || filter !== "all"}
                    className="rounded-md p-1 text-ink-soft hover:bg-secondary disabled:opacity-30"
                    aria-label="Move down"
                    title={filter !== "all" ? "Switch to All to reorder" : "Move down"}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => togglePin(p)}
                  className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
                  aria-label={p.pinned ? "Unpin" : "Pin"}
                  title={p.pinned ? "Unpin" : "Pin to top"}
                >
                  {p.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setEditing(p)}
                  className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this post?")) del(p.id);
                  }}
                  className="rounded-md p-1.5 text-cherry hover:bg-accent"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
        {shown.length === 0 ? (
          <li className="rounded-xl bg-card p-8 text-center text-sm text-ink-soft ring-1 ring-border">
            No posts here.
          </li>
        ) : null}
      </ul>

      {editing ? (
        <PostEditor
          value={editing}
          onCancel={() => setEditing(null)}
          onSave={(next) => {
            upsert(next);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PostEditor({
  value,
  onSave,
  onCancel,
}: {
  value: FeedPost;
  onSave: (p: FeedPost) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FeedPost>(value);
  const [publishMode, setPublishMode] = useState<"now" | "schedule">(
    new Date(value.postedAt).getTime() > Date.now() ? "schedule" : "now",
  );

  function update<K extends keyof FeedPost>(k: K, v: FeedPost[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const dateLocal = new Date(form.postedAt).toISOString().slice(0, 16);
  const scheduled = new Date(form.postedAt).getTime() > Date.now();

  const submit = () => {
    const final: FeedPost = {
      ...form,
      postedAt: publishMode === "now" ? new Date().toISOString() : form.postedAt,
    };
    onSave(final);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card shadow-xl">
        <header className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <h3 className="font-display text-lg font-bold">
            {value.title ? "Edit post" : "New post"}
          </h3>
          <button onClick={onCancel} className="rounded-md p-1.5 text-ink-soft hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-4 p-5">
          <Label label="Title">
            <input
              className={inp}
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <Label label="Type">
              <select
                className={inp}
                value={form.type}
                onChange={(e) => update("type", e.target.value as FeedPost["type"])}
              >
                <option value="news">news</option>
                <option value="notice">notice</option>
                <option value="weather">weather</option>
                <option value="update">update</option>
              </select>
            </Label>
            <Label label="Author">
              <input
                className={inp}
                value={form.author}
                onChange={(e) => update("author", e.target.value)}
              />
            </Label>
          </div>
          <Label label="Body">
            <textarea
              className={`${inp} min-h-32`}
              value={form.body}
              onChange={(e) => update("body", e.target.value)}
            />
          </Label>

          <div>
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Publish
            </span>
            <div className="mb-2 inline-flex rounded-lg bg-secondary p-1">
              {(["now", "schedule"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPublishMode(m)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                    publishMode === m ? "bg-white text-ink shadow-sm" : "text-ink-soft"
                  }`}
                >
                  {m === "now" ? "Post now" : "Schedule"}
                </button>
              ))}
            </div>
            {publishMode === "schedule" ? (
              <>
                <input
                  type="datetime-local"
                  className={inp}
                  value={dateLocal}
                  onChange={(e) => update("postedAt", new Date(e.target.value).toISOString())}
                />
                <p className="mt-1 text-[11px] text-ink-soft">
                  {scheduled
                    ? "Hidden from riders until this time."
                    : "This time is in the past — post will appear immediately."}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-ink-soft">Posts immediately with the current time.</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={!!form.pinned}
              onChange={(e) => update("pinned", e.target.checked)}
              className="h-4 w-4 accent-[oklch(0.55_0.23_25)]"
            />
            Pin to top of feed
          </label>
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={!form.title.trim() || !form.body.trim()}
            onClick={submit}
            className="rounded-lg bg-cherry px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {publishMode === "schedule" && new Date(form.postedAt).getTime() > Date.now()
              ? "Schedule post"
              : "Publish post"}
          </button>
        </footer>
      </div>
    </div>
  );
}

const inp =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cherry focus:ring-2 focus:ring-cherry/20";
function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}
