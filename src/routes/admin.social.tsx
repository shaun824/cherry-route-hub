import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Instagram, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { runSocialSync } from "@/lib/social.functions";

export const Route = createFileRoute("/admin/social")({
  head: () => ({
    meta: [
      { title: "Social feeds · Red Cherry Events admin" },
      {
        name: "description",
        content: "Manage the Instagram and Facebook links and the post wall shown on each event.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SocialAdminPage,
});

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  website_url: string | null;
  social_links: Record<string, string> | null;
};

type PostRow = { id: string; event_id: string | null; post_url: string; source: string | null };

function SocialAdminPage() {
  const qc = useQueryClient();
  const sync = useServerFn(runSocialSync);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const events = useQuery({
    queryKey: ["admin-social-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, website_url, social_links, days")
        .neq("lifecycle", "archived")
        .order("event_date", { ascending: true });
      if (error) throw new Error(error.message);
      return visibleInBackend((data ?? []) as (EventRow & { days?: unknown[] })[]);
    },
  });

  const posts = useQuery({
    queryKey: ["admin-social-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_social_posts")
        .select("id, event_id, post_url, source")
        .order("sort_index", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PostRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-social-posts"] });
    qc.invalidateQueries({ queryKey: ["admin-social-events"] });
  };

  const scrape = useMutation({
    mutationFn: (eventId?: string) => sync({ data: eventId ? { eventId } : {} }),
    onSuccess: (res: any) => {
      const total = res.results.reduce((n: number, r: any) => n + r.posts, 0);
      toast.success(`Checked ${res.results.length} website(s) — ${total} posts found`);
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Sync failed"),
  });

  const saveLinks = useMutation({
    mutationFn: async (input: { id: string; links: Record<string, string> }) => {
      const { error } = await supabase.from("events").update({ social_links: input.links }).eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Social links saved");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const addPost = useMutation({
    mutationFn: async (input: { eventId: string; url: string }) => {
      const { error } = await supabase.from("event_social_posts").insert({
        event_id: input.eventId,
        post_url: input.url.split("?")[0],
        source: "manual",
        sort_index: -1,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Post added");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not add post"),
  });

  const removePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_social_posts").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Social feeds</h1>
          <p className="text-sm text-ink-soft">
            Handles show on every event page. Posts appear on the home page wall and at the bottom of the
            event info page.
          </p>
        </div>
        <button
          onClick={() => scrape.mutate(undefined)}
          disabled={scrape.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${scrape.isPending ? "animate-spin" : ""}`} />
          Check all websites
        </button>
      </div>

      <div className="space-y-3">
        {(events.data ?? []).map((ev) => {
          const links = ev.social_links ?? {};
          const evPosts = (posts.data ?? []).filter((p) => p.event_id === ev.id);
          return (
            <div key={ev.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{ev.name}</p>
                  <p className="text-xs text-ink-soft">{ev.website_url ?? "No website on file"}</p>
                </div>
                <button
                  onClick={() => scrape.mutate(ev.id)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"
                >
                  Check website
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(["instagram", "facebook"] as const).map((key) => (
                  <label key={key} className="text-xs font-semibold capitalize text-ink-soft">
                    {key}
                    <input
                      defaultValue={links[key] ?? ""}
                      placeholder={`https://www.${key}.com/…`}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value === (links[key] ?? "")) return;
                        saveLinks.mutate({ id: ev.id, links: { ...links, [key]: value } });
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-normal text-ink"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold text-ink-soft">
                  Posts on the wall ({evPosts.length})
                </p>
                <ul className="mt-1.5 space-y-1">
                  {evPosts.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-2.5 py-1.5">
                      <Instagram className="h-3.5 w-3.5 shrink-0 text-cherry" />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">{p.post_url}</span>
                      <button onClick={() => removePost.mutate(p.id)} aria-label="Remove post">
                        <Trash2 className="h-3.5 w-3.5 text-ink-soft" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    value={drafts[ev.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [ev.id]: e.target.value }))}
                    placeholder="Paste an Instagram post or reel link"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => {
                      const url = (drafts[ev.id] ?? "").trim();
                      if (!/instagram\.com\/(p|reel|tv)\//.test(url)) {
                        toast.error("That doesn't look like an Instagram post link");
                        return;
                      }
                      addPost.mutate({ eventId: ev.id, url });
                      setDrafts((d) => ({ ...d, [ev.id]: "" }));
                    }}
                    className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
