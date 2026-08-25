// Admin: create username-only logins for on-site crew who don't have email.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HardHat, KeyRound, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createCrewLogin, deleteCrewLogin, listCrewLogins, resetCrewPassword } from "@/lib/crew-accounts.functions";
import { inviteCrewMember } from "@/lib/crew-invite.functions";
import { normaliseCrewUsername } from "@/lib/crew-username";

export const Route = createFileRoute("/admin/crew")({
  head: () => ({
    meta: [
      { title: "Crew logins · Red Cherry admin" },
      { name: "description", content: "Create and manage username-only sign-ins for Red Cherry event crew." },
      { property: "og:title", content: "Crew logins · Red Cherry admin" },
      { property: "og:description", content: "Username-only crew accounts for staff without email addresses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminCrewPage,
});

function AdminCrewPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCrewLogins);
  const create = useServerFn(createCrewLogin);
  const reset = useServerFn(resetCrewPassword);
  const remove = useServerFn(deleteCrewLogin);

  const invite = useServerFn(inviteCrewMember);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  const q = useQuery({ queryKey: ["crew-logins"], queryFn: () => list() });

  const inviteM = useMutation({
    mutationFn: () => invite({ data: { email: inviteEmail, full_name: inviteName } }),
    onSuccess: (r: { emailed: boolean; temp_password: string | null; email: string }) => {
      toast.success(
        r.emailed
          ? `Training invite sent to ${r.email}${r.temp_password ? ` (temp password ${r.temp_password})` : ""}`
          : `${r.email} is suppressed — no email sent.`,
        { duration: 12000 },
      );
      setInviteEmail("");
      setInviteName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const createM = useMutation({
    mutationFn: () => create({ data: { username, password, full_name: fullName } }),
    onSuccess: () => {
      toast.success(`Crew login "${normaliseCrewUsername(username)}" created.`);
      setUsername("");
      setPassword("");
      setFullName("");
      void qc.invalidateQueries({ queryKey: ["crew-logins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetM = useMutation({
    mutationFn: (v: { username: string; password: string }) => reset({ data: v }),
    onSuccess: () => toast.success("Password updated."),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    mutationFn: (v: string) => remove({ data: { username: v } }),
    onSuccess: () => {
      toast.success("Crew login removed.");
      void qc.invalidateQueries({ queryKey: ["crew-logins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 pb-24">
      <header>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
          <HardHat className="h-5 w-5 text-cherry" /> Crew logins
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Crew without an email address sign in at <span className="font-semibold">/crew/login</span> with just a
          username and password.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          inviteM.mutate();
        }}
        className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border"
      >
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          Invite crew by email (with training)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">Work email</span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              placeholder="name@redcherryevents.co.za"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-cherry"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">Name</span>
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-cherry"
            />
          </label>
        </div>
        <p className="text-[11px] text-ink-soft">
          Creates their crew portal account and emails them a sign-in plus a link to start the training and tests.
        </p>
        <button
          type="submit"
          disabled={inviteM.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-cherry px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {inviteM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
          Send crew invite
        </button>
      </form>



      <form
        onSubmit={(e) => {
          e.preventDefault();
          createM.mutate();
        }}
        className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border"
      >
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">New crew login</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              placeholder="RedCherryCrew"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-cherry"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-cherry"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">Name (optional)</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-cherry"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={createM.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-cherry px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {createM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Create crew login
        </button>
      </form>

      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Existing crew logins</p>
        {q.isLoading ? (
          <p className="mt-3 text-sm text-ink-soft">Loading…</p>
        ) : q.error ? (
          <p className="mt-3 text-sm text-cherry">{(q.error as Error).message}</p>
        ) : (q.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No username logins yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {(q.data ?? []).map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{u.username}</p>
                  <p className="truncate text-[11px] text-ink-soft">
                    {u.full_name || "—"} ·{" "}
                    {u.last_sign_in_at
                      ? `last in ${new Date(u.last_sign_in_at).toLocaleDateString("en-ZA")}`
                      : "never signed in"}
                    {u.is_crew ? "" : " · no crew role"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = window.prompt(`New password for ${u.username}`);
                    if (next && next.length >= 4) resetM.mutate({ username: u.username, password: next });
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold text-ink-soft"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove the "${u.username}" crew login?`)) removeM.mutate(u.username);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold text-cherry"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
