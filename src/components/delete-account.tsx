import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { deleteMyAccount } from "@/lib/account-deletion.functions";
import { supabase } from "@/integrations/supabase/client";
import { forgetAccount } from "@/lib/known-accounts";

export function DeleteAccount({ email }: { email?: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removeAccount = useServerFn(deleteMyAccount);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function confirmDeletion() {
    if (confirmation !== "DELETE" || busy) return;
    setBusy(true);
    setError(null);
    let disconnectApple = false;
    try {
      const { data, error: identityError } = await supabase.auth.getUser();
      if (identityError || !data.user) throw new Error("Please sign in again before deleting your account.");
      disconnectApple = data.user.identities?.some((identity) => identity.provider === "apple") ?? false;
      await queryClient.cancelQueries();
      await removeAccount({ data: { confirmation: "DELETE" } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account deletion could not be completed. Please try again.");
      setBusy(false);
      return;
    }
    queryClient.clear();
    if (email) forgetAccount(email);
    await supabase.auth.signOut({ scope: "local" });
    await navigate({ to: "/auth", search: { deleted: true, disconnectApple }, replace: true });
  }

  return (
    <section className="mx-5 mt-6 border-t border-border pt-4">
      <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setConfirmation(""); setError(null); setOpen(true); }}>
        <Trash2 /> Delete my account
      </Button>
      <AlertDialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-lg sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your profile, sign-in account, tracking locations, SOS records, notification tokens, favourites and other personal app data. Your phone, ID details and emergency contacts are removed. Event entries and results stay on file as race records, without a link to your account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="space-y-2 text-sm">
            <span className="block font-semibold">Type DELETE to confirm</span>
            <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" aria-label="Type DELETE to confirm" autoComplete="off" value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={confirmation !== "DELETE" || busy} onClick={() => void confirmDeletion()}>
              <Trash2 /> {busy ? "Deleting…" : "Delete account permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}