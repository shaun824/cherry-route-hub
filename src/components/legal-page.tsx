import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export const LEGAL_CONTACT = "info@redcherryevents.co.za";
export const LEGAL_UPDATED = "9 October 2026";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-sm leading-relaxed text-foreground">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Red Cherry Events · Rider Hub</p>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
        <p>{intro}</p>
      </header>
      {children}
      <footer className="border-t border-border pt-4 text-muted-foreground">
        Questions? Email <a className="underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.{" "}
        <Link to="/policy" className="underline">Privacy policy</Link> ·{" "}
        <Link to="/terms-of-service" className="underline">Terms of service</Link>
      </footer>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
