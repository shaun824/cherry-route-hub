import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, ExternalLink, X } from "lucide-react";

import type { EventPromo } from "@/lib/event-promos";

/**
 * The approved rider-offer reminder pop-up. Shown wherever an offer is tapped
 * (offer cards and the inline strips inside the route sections) so the wording
 * and the "Continue to <brand>" gesture are identical everywhere.
 */
export function PromoReminderDialog({
  promo,
  open,
  onClose,
}: {
  promo: EventPromo;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const hasLink = Boolean(promo.url && promo.url !== "#");

  function copy() {
    if (!promo.code) return;
    try {
      navigator.clipboard?.writeText(promo.code);
    } catch {
      /* clipboard blocked — the code is still shown on screen */
    }
    setCopied(true);
  }

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  // Opening always copies, so the code is ready to paste.
  useEffect(() => {
    if (open) copy();
    else setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-black/60 px-6 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${promo.brand} offer`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-card p-6 text-center ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {promo.logoUrl ? (
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-white p-1.5 ring-1 ring-border">
            <img
              src={promo.logoUrl}
              alt={`${promo.brand} logo`}
              className="max-h-11 max-w-11 object-contain"
            />
          </span>
        ) : null}

        {/* Always restate the offer, then the code (or how to redeem). */}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {promo.brand}
        </p>
        <p className="mt-1 font-display text-lg font-bold leading-tight text-ink">{promo.title}</p>
        {promo.discount ? (
          <span className="mt-2 inline-flex rounded-md bg-accent px-2 py-1 text-[11px] font-black uppercase text-cherry-deep">
            {/^\d+$/.test(promo.discount) ? `${promo.discount}%` : promo.discount} off
          </span>
        ) : null}
        {promo.blurb ? <p className="mt-2 text-xs text-muted-foreground">{promo.blurb}</p> : null}

        {promo.code ? (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Remember to use this code at {promo.brand}
            </p>
            <p className="mt-2 select-all font-mono text-3xl font-black tracking-wide text-ink">
              {promo.code}
            </p>
            <button
              type="button"
              onClick={copy}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-bold text-ink"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Code copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy code
                </>
              )}
            </button>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{promo.redeem}</p>
        )}

        {hasLink ? (
          <a
            href={promo.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cherry px-4 py-3 text-sm font-bold text-white"
          >
            Continue to {promo.brand} <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className={
            hasLink
              ? "mt-2 w-full rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground"
              : "mt-5 w-full rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white"
          }
        >
          {hasLink ? "Not now" : "Got it"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
