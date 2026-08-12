// Icon catalogue for village map points: raw SVG markup for Leaflet div icons and
// matching lucide components for React UI.
import { Baby, Beer, Bike, BriefcaseMedical, Camera, Car, CircleParking, ClipboardCheck, Coffee, Dog, Droplets, Flag, Fuel, HandPlatter, HeartPulse, Info, LandPlot, MapPin, Megaphone, MonitorPlay, Music, Package, PlugZap, Shield, ShoppingBag, ShowerHead, Star, Sun, Tent, TentTree, Ticket, Toilet, Trophy, Truck, Users, Utensils, Wifi, Wrench, Zap, type LucideIcon } from "lucide-react";

export type VillageIconId = "tent" | "tent-tree" | "car" | "truck" | "utensils" | "coffee" | "beer" | "wrench" | "bike" | "droplets" | "toilet" | "shower-head" | "zap" | "plug-zap" | "heart-pulse" | "briefcase-medical" | "shopping-bag" | "flag" | "trophy" | "clipboard-check" | "music" | "camera" | "info" | "monitor-play" | "users" | "map-pin" | "wifi" | "shield" | "fuel" | "sun" | "star" | "circle-parking" | "hand-platter" | "package" | "baby" | "dog" | "land-plot" | "megaphone" | "ticket";

export const VILLAGE_ICONS: { id: VillageIconId; label: string; svg: string; Comp: LucideIcon }[] = [
  { id: "tent", label: "Tent", Comp: Tent, svg: "<path d=\"M3.5 21 14 3\"/><path d=\"M20.5 21 10 3\"/><path d=\"M15.5 21 12 15l-3.5 6\"/><path d=\"M2 21h20\"/>" },
  { id: "tent-tree", label: "Tented village", Comp: TentTree, svg: "<circle cx=\"4\" cy=\"4\" r=\"2\"/><path d=\"m14 5 3-3 3 3\"/><path d=\"m14 10 3-3 3 3\"/><path d=\"M17 14V2\"/><path d=\"M17 14H7l-5 8h20Z\"/><path d=\"M8 14v8\"/><path d=\"m9 14 5 8\"/>" },
  { id: "car", label: "Car / parking", Comp: Car, svg: "<circle cx=\"7\" cy=\"17\" r=\"2\"/><path d=\"M9 17h6\"/><circle cx=\"17\" cy=\"17\" r=\"2\"/>" },
  { id: "truck", label: "Truck", Comp: Truck, svg: "<path d=\"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2\"/><path d=\"M15 18H9\"/><circle cx=\"17\" cy=\"18\" r=\"2\"/><circle cx=\"7\" cy=\"18\" r=\"2\"/>" },
  { id: "utensils", label: "Food", Comp: Utensils, svg: "<path d=\"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2\"/><path d=\"M7 2v20\"/><path d=\"M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7\"/>" },
  { id: "coffee", label: "Coffee", Comp: Coffee, svg: "<path d=\"M10 2v2\"/><path d=\"M14 2v2\"/><path d=\"M6 2v2\"/>" },
  { id: "beer", label: "Bar", Comp: Beer, svg: "<path d=\"M17 11h1a3 3 0 0 1 0 6h-1\"/><path d=\"M9 12v6\"/><path d=\"M13 12v6\"/><path d=\"M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8\"/>" },
  { id: "wrench", label: "Tech / repairs", Comp: Wrench, svg: "" },
  { id: "bike", label: "Bike", Comp: Bike, svg: "<circle cx=\"18.5\" cy=\"17.5\" r=\"3.5\"/><circle cx=\"5.5\" cy=\"17.5\" r=\"3.5\"/><circle cx=\"15\" cy=\"5\" r=\"1\"/><path d=\"M12 17.5V14l-3-3 4-3 2 3h2\"/>" },
  { id: "droplets", label: "Bike wash", Comp: Droplets, svg: "" },
  { id: "toilet", label: "Toilets", Comp: Toilet, svg: "<path d=\"M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8\"/>" },
  { id: "shower-head", label: "Showers", Comp: ShowerHead, svg: "<path d=\"m4 4 2.5 2.5\"/><path d=\"M13.5 6.5a4.95 4.95 0 0 0-7 7\"/><path d=\"M15 5 5 15\"/><path d=\"M14 17v.01\"/><path d=\"M10 16v.01\"/><path d=\"M13 13v.01\"/><path d=\"M16 10v.01\"/><path d=\"M11 20v.01\"/><path d=\"M17 14v.01\"/><path d=\"M20 11v.01\"/>" },
  { id: "zap", label: "E-bike charging", Comp: Zap, svg: "" },
  { id: "plug-zap", label: "Charging station", Comp: PlugZap, svg: "<path d=\"m2 22 3-3\"/><path d=\"M7.5 13.5 10 11\"/><path d=\"M10.5 16.5 13 14\"/><path d=\"m18 3-4 4h6l-4 4\"/>" },
  { id: "heart-pulse", label: "Medical", Comp: HeartPulse, svg: "<path d=\"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27\"/>" },
  { id: "briefcase-medical", label: "First aid", Comp: BriefcaseMedical, svg: "<path d=\"M12 11v4\"/><path d=\"M14 13h-4\"/><path d=\"M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2\"/><path d=\"M18 6v14\"/><path d=\"M6 6v14\"/><rect width=\"20\" height=\"14\" x=\"2\" y=\"6\" rx=\"2\"/>" },
  { id: "shopping-bag", label: "Merch / shop", Comp: ShoppingBag, svg: "<path d=\"M16 10a4 4 0 0 1-8 0\"/><path d=\"M3.103 6.034h17.794\"/>" },
  { id: "flag", label: "Start", Comp: Flag, svg: "" },
  { id: "trophy", label: "Finish", Comp: Trophy, svg: "<path d=\"M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978\"/><path d=\"M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978\"/><path d=\"M18 9h1.5a1 1 0 0 0 0-5H18\"/><path d=\"M4 22h16\"/><path d=\"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z\"/><path d=\"M6 9H4.5a1 1 0 0 1 0-5H6\"/>" },
  { id: "clipboard-check", label: "Registration", Comp: ClipboardCheck, svg: "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"/><path d=\"m9 14 2 2 4-4\"/>" },
  { id: "music", label: "Stage / music", Comp: Music, svg: "<path d=\"M9 18V5l12-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"18\" cy=\"16\" r=\"3\"/>" },
  { id: "camera", label: "Photos", Comp: Camera, svg: "<circle cx=\"12\" cy=\"13\" r=\"3\"/>" },
  { id: "info", label: "Info", Comp: Info, svg: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>" },
  { id: "monitor-play", label: "Expo / demo", Comp: MonitorPlay, svg: "<path d=\"M12 17v4\"/><path d=\"M8 21h8\"/><rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/>" },
  { id: "users", label: "Meeting point", Comp: Users, svg: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><path d=\"M16 3.128a4 4 0 0 1 0 7.744\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/>" },
  { id: "map-pin", label: "Generic pin", Comp: MapPin, svg: "<circle cx=\"12\" cy=\"10\" r=\"3\"/>" },
  { id: "wifi", label: "Wi-Fi", Comp: Wifi, svg: "<path d=\"M12 20h.01\"/><path d=\"M2 8.82a15 15 0 0 1 20 0\"/><path d=\"M5 12.859a10 10 0 0 1 14 0\"/><path d=\"M8.5 16.429a5 5 0 0 1 7 0\"/>" },
  { id: "shield", label: "Security", Comp: Shield, svg: "" },
  { id: "fuel", label: "Fuel", Comp: Fuel, svg: "<path d=\"M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16\"/><path d=\"M2 21h13\"/><path d=\"M3 9h11\"/>" },
  { id: "sun", label: "Chill zone", Comp: Sun, svg: "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>" },
  { id: "star", label: "Highlight", Comp: Star, svg: "" },
  { id: "circle-parking", label: "Parking", Comp: CircleParking, svg: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9 17V7h4a3 3 0 0 1 0 6H9\"/>" },
  { id: "hand-platter", label: "Catering", Comp: HandPlatter, svg: "<path d=\"M12 3V2\"/><path d=\"M2 14h12a2 2 0 0 1 0 4h-2\"/><path d=\"M4 10h16\"/><path d=\"M5 10a7 7 0 0 1 14 0\"/><path d=\"M5 14v6a1 1 0 0 1-1 1H2\"/>" },
  { id: "package", label: "Race packs", Comp: Package, svg: "<path d=\"M12 22V12\"/><polyline points=\"3.29 7 12 12 20.71 7\"/><path d=\"m7.5 4.27 9 5.15\"/>" },
  { id: "baby", label: "Kids", Comp: Baby, svg: "<path d=\"M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5\"/><path d=\"M15 12h.01\"/><path d=\"M9 12h.01\"/>" },
  { id: "dog", label: "Pets", Comp: Dog, svg: "<path d=\"M11.25 16.25h1.5L12 17z\"/><path d=\"M16 14v.5\"/><path d=\"M8 14v.5\"/>" },
  { id: "land-plot", label: "Field / area", Comp: LandPlot, svg: "<path d=\"m12 8 6-3-6-3v10\"/><path d=\"m6.49 12.85 11.02 6.3\"/><path d=\"M17.51 12.85 6.5 19.15\"/>" },
  { id: "megaphone", label: "Announcements", Comp: Megaphone, svg: "<path d=\"M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14\"/><path d=\"M8 6v8\"/>" },
  { id: "ticket", label: "Tickets", Comp: Ticket, svg: "<path d=\"M13 5v2\"/><path d=\"M13 17v2\"/><path d=\"M13 11v2\"/>" },
];

const BY_ID = new Map(VILLAGE_ICONS.map((i) => [i.id, i]));

export function villageIcon(id: string | undefined | null) {
  return (id && BY_ID.get(id as VillageIconId)) || BY_ID.get("map-pin")!;
}

/** Keyword rules, first match wins — driven by the point's name. */
const NAME_RULES: [RegExp, VillageIconId][] = [
  [/regist|check[- ]?in|race pack|number board/i, "clipboard-check"],
  [/start/i, "flag"],
  [/finish/i, "trophy"],
  [/truck|trailer/i, "truck"],
  [/park/i, "circle-parking"],
  [/tented village|tented|pre-?pitched/i, "tent-tree"],
  [/tent|camp/i, "tent"],
  [/shower/i, "shower-head"],
  [/toilet|ablution|loo|bathroom/i, "toilet"],
  [/bike wash|wash/i, "droplets"],
  [/e-?bike charg|battery/i, "zap"],
  [/charg|power/i, "plug-zap"],
  [/bike|mechanic|tech|spares|workshop/i, "wrench"],
  [/coffee|barista|cafe/i, "coffee"],
  [/bar|beer|chill|pub|garden/i, "beer"],
  [/food|vendor|restaurant|dinner|breakfast|catering|kitchen/i, "utensils"],
  [/merch|shop|store|retail/i, "shopping-bag"],
  [/medic|first aid|doctor|ambulance|physio/i, "heart-pulse"],
  [/expo|demo/i, "monitor-play"],
  [/stage|music|band|entertain/i, "music"],
  [/media|photo|camera|press/i, "camera"],
  [/wifi|wi-fi|internet/i, "wifi"],
  [/security|marshal/i, "shield"],
  [/fuel|petrol|diesel/i, "fuel"],
  [/info|help|office|admin/i, "info"],
  [/kids|creche|children/i, "baby"],
  [/dog|pet/i, "dog"],
  [/brief|announce|prize giving|prizegiving/i, "megaphone"],
  [/meet|gather/i, "users"],
];

const CATEGORY_ICON: Record<string, VillageIconId> = {
  registration: "clipboard-check",
  start: "flag",
  finish: "trophy",
  food: "utensils",
  bar: "beer",
  camping: "tent",
  parking: "circle-parking",
  medical: "heart-pulse",
  bike: "wrench",
  stage: "music",
  toilets: "toilet",
  shop: "shopping-bag",
  other: "map-pin",
};

/** Picks a sensible icon from the point name, falling back to its category. */
export function guessVillageIcon(title: string, category?: string): VillageIconId {
  for (const [rx, id] of NAME_RULES) if (rx.test(title || "")) return id;
  return CATEGORY_ICON[category ?? "other"] ?? "map-pin";
}

/** Inline SVG markup sized for Leaflet div icons. */
export function villageIconSvg(id: string | undefined | null, size = 12, color = "#fff") {
  const icon = villageIcon(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${icon.svg}</svg>`;
}

/** Colour swatches offered when overriding a point's colour. */
export const VILLAGE_COLORS = [
  "#e11d48", "#dc2626", "#f97316", "#ca8a04", "#65a30d", "#16a34a",
  "#0d9488", "#0ea5e9", "#0284c7", "#2563eb", "#a855f7", "#d946ef",
  "#475569", "#334155", "#111827",
];
