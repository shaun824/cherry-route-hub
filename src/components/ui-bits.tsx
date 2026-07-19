import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import rceLogo from "@/assets/rce-logo.png.asset.json";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur-md"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
    >
      <div className="min-w-0">
        <h1 className="truncate font-display text-[22px] font-bold leading-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-2xl bg-white p-1.5 shadow-md ring-1 ring-white/60"
      style={{ width: size, height: size }}
      aria-label="Red Cherry Events"
    >
      <img
        src={rceLogo.url}
        alt="Red Cherry Events"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    weather: "bg-amber-100 text-amber-900",
    notice: "bg-blue-100 text-blue-900",
    update: "bg-violet-100 text-violet-900",
    news: "bg-accent text-cherry-deep",
    open: "bg-emerald-100 text-emerald-900",
    live: "bg-cherry text-cherry-foreground",
    closed: "bg-muted text-muted-foreground",
    upcoming: "bg-secondary text-secondary-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        map[type] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {type}
    </span>
  );
}

export function SectionTitle({
  title,
  action,
  actionTo,
}: {
  title: string;
  action?: string;
  actionTo?: string;
}) {
  return (
    <div className="flex items-baseline justify-between px-5 pb-2 pt-6">
      <h2 className="font-display text-[15px] font-bold uppercase tracking-wider text-ink-soft">
        {title}
      </h2>
      {action && actionTo ? (
        <Link to={actionTo} className="text-xs font-semibold text-cherry">
          {action} →
        </Link>
      ) : null}
    </div>
  );
}
