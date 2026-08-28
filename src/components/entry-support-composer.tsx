import { useEffect, useMemo, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { useSession } from "@/lib/auth";
import { entryNinjaRegistrationId } from "@/lib/entry-ninja-link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function EntrySupportComposer({
  eventName,
  registrationRef,
}: {
  eventName: string;
  registrationRef: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-card px-3 py-3 text-sm font-bold text-cherry ring-1 ring-border transition hover:bg-secondary/60"
        >
          <Mail className="h-4 w-4" /> Email Entry Ninja support
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Email Entry Ninja support</DialogTitle>
        </DialogHeader>
        <ComposerBody eventName={eventName} registrationRef={registrationRef} />
      </DialogContent>
    </Dialog>
  );
}

function ComposerBody({
  eventName,
  registrationRef,
}: {
  eventName: string;
  registrationRef: string | null;
}) {
  const { user } = useSession();
  const regId = entryNinjaRegistrationId(registrationRef) ?? "unknown";
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const riderName = useMemo(() => {
    const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
    return meta?.full_name || meta?.name || user?.email || "[your name]";
  }, [user]);

  const subject = `Request to update my entry for ${eventName} (Reg #${regId})`;
  const bodyIntro = `Hi Entry Ninja Support team, I would like to request a change to my entry for ${eventName} with Registration number: ${regId}.\n\n`;
  const bodyOutro = `\n\nThank you\n${riderName}`;

  const mailtoHref = useMemo(() => {
    const fullBody = `${bodyIntro}${message}${bodyOutro}`;
    const enc = (v: string) => encodeURIComponent(v);
    return `mailto:Support@entryninja.com?cc=${enc("team@redcherryevents.co.za")}&subject=${enc(subject)}&body=${enc(fullBody)}`;
  }, [message, subject, bodyIntro, bodyOutro]);

  return (
    <div className="overflow-hidden bg-card">
      <div className="border-b border-border bg-secondary/40 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          Email Entry Ninja support
        </p>
      </div>
      <div className="px-3 py-2 text-[13px] leading-snug">
        <div className="flex gap-2 border-b border-border/60 py-1.5">
          <span className="w-14 shrink-0 text-[11px] font-semibold text-ink-soft">To</span>
          <span className="text-[13px] text-ink">Support@entryninja.com</span>
        </div>
        <div className="flex gap-2 border-b border-border/60 py-1.5">
          <span className="w-14 shrink-0 text-[11px] font-semibold text-ink-soft">Cc</span>
          <span className="text-[13px] text-ink">team@redcherryevents.co.za</span>
        </div>
        <div className="flex gap-2 border-b border-border/60 py-1.5">
          <span className="w-14 shrink-0 text-[11px] font-semibold text-ink-soft">From</span>
          <span className="text-[13px] text-ink">{user?.email ?? "[your email]"}</span>
        </div>
        <div className="flex gap-2 border-b border-border/60 py-1.5">
          <span className="w-14 shrink-0 text-[11px] font-semibold text-ink-soft">Subject</span>
          <span className="truncate text-[13px] text-ink">{subject}</span>
        </div>
        <div className="mt-3 space-y-3 text-[13px] text-ink">
          <p>
            Hi Entry Ninja Support team, I would like to request a change to my entry for{" "}
            {eventName} with Registration number: {regId}.
          </p>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your request here…"
            className="min-h-[120px] w-full resize-y rounded-lg bg-secondary px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-cherry"
          />
          <p>Thank you</p>
          <p>{riderName}</p>
        </div>
      </div>
      <a
        href={mailtoHref}
        className="flex w-full items-center justify-center gap-2 bg-cherry px-3 py-3 text-sm font-bold text-white active:opacity-90"
      >
        <Mail className="h-4 w-4" /> Open in email app
      </a>
    </div>
  );
}
