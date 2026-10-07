import { AlertTriangle } from "lucide-react";
import { missingSizeMessage, type ApparelFlags } from "@/lib/apparel";

export function MissingSizeCallout({ missing, href }: { missing: ApparelFlags; href: string }) {
  const msg = missingSizeMessage(missing);
  if (!msg) return null;
  return (
    <div className="mt-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-300 print:hidden">
      <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {msg}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white"
      >
        Add my size on Entry Ninja
      </a>
    </div>
  );
}
