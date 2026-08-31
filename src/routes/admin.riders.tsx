import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldOff, Eye, HardHat, UserX } from "lucide-react";
import { listUnlinkedEntrants } from "@/lib/roster.functions";

import { toast } from "sonner";

export const Route = createFileRoute("/admin/riders")({
  component: RidersAdmin,
});

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  entry_ninja_id: string | null;
  created_at: string;
};

type RoleRow = { user_id: string; role: string };

function RidersAdmin() {
  const qc = useQueryClient();

  const profilesQ = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,phone,entry_ninja_id,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["admin", "user_roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const promote = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Admin role granted");
      qc.invalidateQueries({ queryKey: ["admin", "user_roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const demote = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Admin role removed");
      qc.invalidateQueries({ queryKey: ["admin", "user_roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, grant }: { userId: string; grant: boolean }) => {
      if (grant) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "crew" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "crew");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Crew access updated");
      qc.invalidateQueries({ queryKey: ["admin", "user_roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const crewIds = new Set(
    (rolesQ.data ?? []).filter((r) => r.role === "crew").map((r) => r.user_id),
  );

  const adminIds = new Set(
    (rolesQ.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Riders & roles</h1>
        <p className="text-sm text-ink-soft">
          Everyone who signs in appears here. Grant admin access to trusted staff, or crew access so on-site staff can look up rooming lists.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-[11px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Entry Ninja ID</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profilesQ.isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-soft">Loading…</td></tr>
            ) : (profilesQ.data ?? []).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-soft">No riders yet.</td></tr>
            ) : (profilesQ.data ?? []).map((p) => {
              const isAdmin = adminIds.has(p.id);
              const isCrew = crewIds.has(p.id);
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold text-ink">{p.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">{p.entry_ninja_id ?? "—"}</td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cherry/10 px-2 py-0.5 text-[11px] font-semibold text-cherry-deep">
                        <ShieldCheck className="h-3 w-3" /> Admin
                      </span>
                    ) : isCrew ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-semibold text-ink">
                        <HardHat className="h-3 w-3" /> Crew
                      </span>
                    ) : (
                      <span className="text-[11px] text-ink-soft">Rider</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/admin/rider/$userId"
                      params={{ userId: p.id }}
                      className="mr-2 inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-ink-soft hover:text-cherry"
                    >
                      <Eye className="h-3 w-3" /> View profile
                    </Link>
                    <button
                      onClick={() => setRole.mutate({ userId: p.id, grant: !isCrew })}
                      disabled={setRole.isPending}
                      className="mr-2 inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-ink-soft"
                    >
                      <HardHat className="h-3 w-3" /> {isCrew ? "Remove crew" : "Make crew"}
                    </button>
                    {isAdmin ? (

                      <button
                        onClick={() => demote.mutate(p.id)}
                        disabled={demote.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-ink-soft"
                      >
                        <ShieldOff className="h-3 w-3" /> Remove admin
                      </button>
                    ) : (
                      <button
                        onClick={() => promote.mutate(p.id)}
                        disabled={promote.isPending}
                        className="inline-flex items-center gap-1 rounded-lg bg-cherry px-2 py-1 text-xs font-semibold text-white"
                      >
                        <ShieldCheck className="h-3 w-3" /> Make admin
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UnlinkedEntrantsCard />
    </div>
  );
}

type UnlinkedEntrant = {
  id: string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
  events: string[];
};

function UnlinkedEntrantsCard() {
  const [open, setOpen] = useState(false);
  const unlinkedQ = useQuery({
    queryKey: ["admin", "unlinked-entrants"],
    queryFn: () => listUnlinkedEntrants({}),
  });

  const rows = (unlinkedQ.data ?? []) as UnlinkedEntrant[];

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cherry/10">
          <UserX className="h-4 w-4 text-cherry" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">
            Unlinked entrants ({unlinkedQ.isLoading ? "…" : rows.length})
          </span>
          <span className="block text-xs text-ink-soft">
            Imported from Entry Ninja but not connected to an app account — usually riders who
            haven't signed in yet, or signed in with a different email.
          </span>
        </span>
        <span className="text-xs font-semibold text-cherry">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-2">
          {unlinkedQ.isLoading ? (
            <p className="py-4 text-center text-sm text-ink-soft">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-soft">
              Every imported entrant is linked to an account.
            </p>
          ) : (
            {rows.length >= 300 && (
              <p className="py-2 text-[11px] font-semibold text-ink-soft">
                Showing the 300 most recent — the rest are riders who never signed in.
              </p>
            )}
            <ul className="divide-y divide-border">
              {rows.map((e) => (
                <li key={e.id} className="py-2.5">
                  <p className="text-sm font-semibold text-ink">{e.fullName ?? "—"}</p>
                  <p className="text-xs text-ink-soft">{e.email ?? "no email on file"}</p>
                  {e.events.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-ink-soft">{e.events.join(" · ")}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
