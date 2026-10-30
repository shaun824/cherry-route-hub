// One visual cue per event type, used on every event list so riders can tell
// what kind of event a row is without reading the label.
import {
  Bike,
  Building2,
  Footprints,
  Motorbike,
  Mountain,
  TreePine,
  Trophy,
  Waves,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

export type EventTypeIcon = {
  Icon: ComponentType<{ className?: string }>;
  label: string;
};

type Rule = {
  keywords: string[];
  Icon: ComponentType<{ className?: string }>;
  label: string;
};

// Ordered most specific first: "Trail Run" must win over a bare "run", and a
// name like "Rallye Raid" must win over a generic "Cycling" discipline.
const RULES: Rule[] = [
  { keywords: ["beach", "surf ski", "surf-ski"], Icon: Waves, label: "Beach & surf event" },
  { keywords: ["trail run", "trail runn"], Icon: TreePine, label: "Trail run" },
  { keywords: ["road run", "fun run", "marathon"], Icon: Footprints, label: "Road run" },
  { keywords: ["urban"], Icon: Building2, label: "Urban adventure" },
  { keywords: ["stage rac"], Icon: Trophy, label: "Stage race" },
  {
    keywords: [
      "motorcy",
      "motorbike",
      "motorcycle",
      "moto",
      "enduro",
      "rally",
      "raid",
      "adventure bik",
      "dual sport",
      "quad",
      "sea to sea",
    ],
    Icon: Motorbike,
    label: "Motorbike event",
  },
  { keywords: ["mountain bike", "mtb", "e-bike", "ebike"], Icon: Mountain, label: "Mountain bike event" },
  { keywords: ["infrastructur", "venue hire"], Icon: Wrench, label: "Venue hire" },
  { keywords: ["cycl", "bicycle", "gravel", "criterium", "road"], Icon: Bike, label: "Cycling event" },
];

const FALLBACK: EventTypeIcon = { Icon: Bike, label: "Cycling event" };

/** Icon and plain-language label for what kind of event this is. */
export function getEventTypeIcon(discipline?: string | null, name?: string | null): EventTypeIcon {
  const text = `${discipline ?? ""} ${name ?? ""}`.toLowerCase();
  const rule = RULES.find((r) => r.keywords.some((k) => text.includes(k)));
  return rule ? { Icon: rule.Icon, label: rule.label } : FALLBACK;
}
