import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, X, Pin } from "lucide-react";
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

function AdminFeed() {
  const feed = useAdminStore((s) => s.feed);
  const upsert = useAdminStore((s) => s.upsertPost);
  const del = useAdminStore((s) => s.deletePost);
  const [editing, setEditing] = useState<FeedPost | null>(null);

  const sorted = [...feed].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  );

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">News feed</h1>
          <p className="text-sm text-ink-soft">Post race notices, weather warnings and updates.</p>
        </div>
        <button
          onClick={() => setEditing(blank())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-2 text-sm font-semibold text-white shadow-sm"
        >
          <Plus className="h-4 w-4" /> New post
        </button>
      </header>

      <ul className="space-y-2">
        {sorted.map((p) => (
          <li
            key={p.id}
            className="flex items-start justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-border"
          >
            <div className="min-w-0">
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
                <span className="text-[11px] text-ink-soft">
                  {new Date(p.postedAt).toLocaleString()} · {p.author}
                </span>
              </div>
              <p className="font-semibold text-ink">{p.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{p.body}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => setEditing(p)}
                className="rounded-md p-1.5 text-ink-soft hover:bg-secondary"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this post?")) del(p.id);
                }}
                className="rounded-md p-1.5 text-cherry hover:bg-accent"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
        {sorted.length === 0 ? (
          <li className="rounded-xl bg-card p-8 text-center text-sm text-ink-soft ring-1 ring-border">
            No posts yet.
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
  function update<K extends keyof FeedPost>(k: K, v: FeedPost[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card shadow-xl">
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
            <input className={inp} value={form.title} onChange={(e) => update("title", e.target.value)} />
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
            onClick={() => onSave({ ...form, postedAt: form.postedAt || new Date().toISOString() })}
            className="rounded-lg bg-cherry px-4 py-2 text-sm font-semibold text-white"
          >
            Save post
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
