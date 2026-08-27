import { useEffect, useMemo, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { useSession } from "@/lib/auth";
import { entryNinjaRegistrationId } from "@/lib/entry-ninja-link";

export function EntrySupportComposer({
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

  const subject = `Request to update my entry for ${eventName} (Reg #${regId})`;
  const bodyIntro = `Hi Entry Ninja Support team,\n\nI would like to request a change to my entry for ${eventName}.\n\nEvent: ${eventName}\nRegistration number: ${regId}\n\nPlease could you assist me with the following change:\n\n`;
  const bodyOutro = `\n\nI have copied the Red Cherry Events team on this email for visibility.\n\nThank you,\n[your name]`;

  const mailtoHref = useMemo(() => {
    const fullBody = `${bodyIntro}${message}${bodyOutro}`;
    const enc = (v: string) => encodeURIComponent(v);
    return `mailto:Support@entryninja.com?cc=${enc("team@redcherryevents.co.za")}&subject=${enc(subject)}&body=${enc(fullBody)}`;
  }, [message, subject, bodyIntro, bodyOutro]);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-card ring-1 ring-border">
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
        <div className="mt-2 space-y-1 text-[13px] text-ink">
          <p>Hi Entry Ninja Support team,</p>
          <p>I would like to request a change to my entry for {eventName}.</p>
          <p>Event: {eventName}</p>
          <p>Registration number: {regId}</p>
          <p>Please could you assist me with the following change:</p>
        </div>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your request here…"
          className="mt-2 min-h-[96px] w-full resize-y rounded-lg bg-secondary px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-cherry"
        />
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
