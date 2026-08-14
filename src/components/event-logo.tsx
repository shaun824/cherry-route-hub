/**
 * Event logo tile.
 *
 * Event logos come from Entry Ninja and are a mix of transparent PNGs and
 * JPGs on white, so the tile always sits on a white plate with `object-contain`
 * padding — that keeps every logo legible on brand-coloured headers and on
 * light cards, on phone, tablet and desktop.
 */
export function EventLogo({
  src,
  name,
  size = "md",
  onBrand = false,
  className = "",
}: {
  src?: string | null;
  name: string;
  /** sm: list rows · md: cards · lg: event hero */
  size?: "sm" | "md" | "lg";
  /** true when the tile sits on a coloured/brand header */
  onBrand?: boolean;
  className?: string;
}) {
  if (!src) return null;

  const box =
    size === "lg"
      ? "h-20 w-20 sm:h-24 sm:w-24 rounded-2xl p-2"
      : size === "md"
        ? "h-14 w-14 sm:h-16 sm:w-16 rounded-2xl p-1.5"
        : "h-12 w-12 rounded-xl p-1";

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden bg-white shadow-sm ${box} ${
        onBrand ? "ring-1 ring-white/60" : "ring-1 ring-border"
      } ${className}`}
    >
      <img
        src={src}
        alt={`${name} logo`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </span>
  );
}
