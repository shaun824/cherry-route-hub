export type EventSport = "moto" | "mtb";

const MOTO_HINTS = [
  "moto",
  "motorbike",
  "motorcycle",
  "enduro",
  "rally",
  "rallye",
  "raid",
  "adventure bik",
  "dual sport",
  "off-road bike",
  "quad",
];

const MTB_HINTS = ["mountain bike", "mtb", "gravel", "cycl", "road", "stage rac", "criterium", "bicycle"];

/** Classify an event as a motorbike or mountain bike event from its discipline/name. */
export function getEventSport(discipline?: string | null, name?: string | null): EventSport {
  const text = `${discipline ?? ""} ${name ?? ""}`.toLowerCase();
  if (MOTO_HINTS.some((h) => text.includes(h))) return "moto";
  if (MTB_HINTS.some((h) => text.includes(h))) return "mtb";
  return "mtb";
}

export function getEventSportLabel(sport: EventSport): string {
  return sport === "moto" ? "Motorbike event" : "Mountain bike event";
}
