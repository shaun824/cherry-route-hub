// Icon catalogue for village map points: raw SVG markup for Leaflet div icons and
// matching lucide components for React UI.
import { Baby, Beer, Bike, BriefcaseMedical, Camera, Car, CircleParking, ClipboardCheck, Coffee, Dog, Droplets, Flag, Fuel, HandPlatter, HeartPulse, Info, LandPlot, MapPin, Megaphone, MonitorPlay, Music, Package, PlugZap, Shield, ShoppingBag, ShowerHead, Star, Sun, Tent, TentTree, Ticket, Toilet, Trophy, Truck, Users, Utensils, Wifi, Wrench, Zap, type LucideIcon } from "lucide-react";

export type VillageIconId = "tent" | "tent-tree" | "car" | "truck" | "utensils" | "coffee" | "beer" | "wrench" | "bike" | "droplets" | "toilet" | "shower-head" | "zap" | "plug-zap" | "heart-pulse" | "briefcase-medical" | "shopping-bag" | "flag" | "trophy" | "clipboard-check" | "music" | "camera" | "info" | "monitor-play" | "users" | "map-pin" | "wifi" | "shield" | "fuel" | "sun" | "star" | "circle-parking" | "hand-platter" | "package" | "baby" | "dog" | "land-plot" | "megaphone" | "ticket";

export const VILLAGE_ICONS: { id: VillageIconId; label: string; svg: string; Comp: LucideIcon }[] = [
  { id: "tent", label: "Tent", Comp: Tent, svg: "<path d=\"M3.5 21 14 3\"/><path d=\"M20.5 21 10 3\"/><path d=\"M15.5 21 12 15l-3.5 6\"/><path d=\"M2 21h20\"/>" },
  { id: "tent-tree", label: "Tented village", Comp: TentTree, svg: "<circle cx=\"4\" cy=\"4\" r=\"2\"/><path d=\"m14 5 3-3 3 3\"/><path d=\"m14 10 3-3 3 3\"/><path d=\"M17 14V2\"/><path d=\"M17 14H7l-5 8h20Z\"/><path d=\"M8 14v8\"/><path d=\"m9 14 5 8\"/>" },
  { id: "car", label: "Car / parking", Comp: Car, svg: "<path d=\"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2\"/><circle cx=\"7\" cy=\"17\" r=\"2\"/><path d=\"M9 17h6\"/><circle cx=\"17\" cy=\"17\" r=\"2\"/>" },
  { id: "truck", label: "Truck", Comp: Truck, svg: "<path d=\"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2\"/><path d=\"M15 18H9\"/><path d=\"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14\"/><circle cx=\"17\" cy=\"18\" r=\"2\"/><circle cx=\"7\" cy=\"18\" r=\"2\"/>" },
  { id: "utensils", label: "Food", Comp: Utensils, svg: "<path d=\"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2\"/><path d=\"M7 2v20\"/><path d=\"M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7\"/>" },
  { id: "coffee", label: "Coffee", Comp: Coffee, svg: "<path d=\"M10 2v2\"/><path d=\"M14 2v2\"/><path d=\"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1\"/><path d=\"M6 2v2\"/>" },
  { id: "beer", label: "Bar", Comp: Beer, svg: "<path d=\"M17 11h1a3 3 0 0 1 0 6h-1\"/><path d=\"M9 12v6\"/><path d=\"M13 12v6\"/><path d=\"M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z\"/><path d=\"M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8\"/>" },
  { id: "wrench", label: "Tech / repairs", Comp: Wrench, svg: "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z\"/>" },
  { id: "bike", label: "Bike", Comp: Bike, svg: "<circle cx=\"18.5\" cy=\"17.5\" r=\"3.5\"/><circle cx=\"5.5\" cy=\"17.5\" r=\"3.5\"/><circle cx=\"15\" cy=\"5\" r=\"1\"/><path d=\"M12 17.5V14l-3-3 4-3 2 3h2\"/>" },
  { id: "droplets", label: "Bike wash", Comp: Droplets, svg: "<path d=\"M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z\"/><path d=\"M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97\"/>" },
  { id: "toilet", label: "Toilets", Comp: Toilet, svg: "<path d=\"M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18\"/><path d=\"M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8\"/>" },
  { id: "shower-head", label: "Showers", Comp: ShowerHead, svg: "<path d=\"m4 4 2.5 2.5\"/><path d=\"M13.5 6.5a4.95 4.95 0 0 0-7 7\"/><path d=\"M15 5 5 15\"/><path d=\"M14 17v.01\"/><path d=\"M10 16v.01\"/><path d=\"M13 13v.01\"/><path d=\"M16 10v.01\"/><path d=\"M11 20v.01\"/><path d=\"M17 14v.01\"/><path d=\"M20 11v.01\"/>" },
  { id: "zap", label: "E-bike charging", Comp: Zap, svg: "<path d=\"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z\"/>" },
  { id: "plug-zap", label: "Charging station", Comp: PlugZap, svg: "<path d=\"M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z\"/><path d=\"m2 22 3-3\"/><path d=\"M7.5 13.5 10 11\"/><path d=\"M10.5 16.5 13 14\"/><path d=\"m18 3-4 4h6l-4 4\"/>" },
  { id: "heart-pulse", label: "Medical", Comp: HeartPulse, svg: "<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\"/><path d=\"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27\"/>" },
  { id: "briefcase-medical", label: "First aid", Comp: BriefcaseMedical, svg: "<path d=\"M12 11v4\"/><path d=\"M14 13h-4\"/><path d=\"M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2\"/><path d=\"M18 6v14\"/><path d=\"M6 6v14\"/><rect width=\"20\" height=\"14\" x=\"2\" y=\"6\" rx=\"2\"/>" },
  { id: "shopping-bag", label: "Merch / shop", Comp: ShoppingBag, svg: "<path d=\"M16 10a4 4 0 0 1-8 0\"/><path d=\"M3.103 6.034h17.794\"/><path d=\"M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z\"/>" },
  { id: "flag", label: "Start", Comp: Flag, svg: "<path d=\"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528\"/>" },
  { id: "trophy", label: "Finish", Comp: Trophy, svg: "<path d=\"M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978\"/><path d=\"M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978\"/><path d=\"M18 9h1.5a1 1 0 0 0 0-5H18\"/><path d=\"M4 22h16\"/><path d=\"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z\"/><path d=\"M6 9H4.5a1 1 0 0 1 0-5H6\"/>" },
  { id: "clipboard-check", label: "Registration", Comp: ClipboardCheck, svg: "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><path d=\"m9 14 2 2 4-4\"/>" },
  { id: "music", label: "Stage / music", Comp: Music, svg: "<path d=\"M9 18V5l12-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"18\" cy=\"16\" r=\"3\"/>" },
  { id: "camera", label: "Photos", Comp: Camera, svg: "<path d=\"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z\"/><circle cx=\"12\" cy=\"13\" r=\"3\"/>" },
  { id: "info", label: "Info", Comp: Info, svg: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>" },
  { id: "monitor-play", label: "Expo / demo", Comp: MonitorPlay, svg: "<path d=\"M15.033 9.44a.647.647 0 0 1 0 1.12l-4.065 2.352a.645.645 0 0 1-.968-.56V7.648a.645.645 0 0 1 .967-.56z\"/><path d=\"M12 17v4\"/><path d=\"M8 21h8\"/><rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/>" },
  { id: "users", label: "Meeting point", Comp: Users, svg: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><path d=\"M16 3.128a4 4 0 0 1 0 7.744\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/>" },
  { id: "map-pin", label: "Generic pin", Comp: MapPin, svg: "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>" },
  { id: "wifi", label: "Wi-Fi", Comp: Wifi, svg: "<path d=\"M12 20h.01\"/><path d=\"M2 8.82a15 15 0 0 1 20 0\"/><path d=\"M5 12.859a10 10 0 0 1 14 0\"/><path d=\"M8.5 16.429a5 5 0 0 1 7 0\"/>" },
  { id: "shield", label: "Security", Comp: Shield, svg: "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"/>" },
  { id: "fuel", label: "Fuel", Comp: Fuel, svg: "<path d=\"M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5\"/><path d=\"M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16\"/><path d=\"M2 21h13\"/><path d=\"M3 9h11\"/>" },
  { id: "sun", label: "Chill zone", Comp: Sun, svg: "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>" },
  { id: "star", label: "Highlight", Comp: Star, svg: "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\"/>" },
  { id: "circle-parking", label: "Parking", Comp: CircleParking, svg: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9 17V7h4a3 3 0 0 1 0 6H9\"/>" },
  { id: "hand-platter", label: "Catering", Comp: HandPlatter, svg: "<path d=\"M12 3V2\"/><path d=\"m15.4 17.4 3.2-2.8a2 2 0 1 1 2.8 2.9l-3.6 3.3c-.7.8-1.7 1.2-2.8 1.2h-4c-1.1 0-2.1-.4-2.8-1.2l-1.302-1.464A1 1 0 0 0 6.151 19H5\"/><path d=\"M2 14h12a2 2 0 0 1 0 4h-2\"/><path d=\"M4 10h16\"/><path d=\"M5 10a7 7 0 0 1 14 0\"/><path d=\"M5 14v6a1 1 0 0 1-1 1H2\"/>" },
  { id: "package", label: "Race packs", Comp: Package, svg: "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"/><path d=\"M12 22V12\"/><polyline points=\"3.29 7 12 12 20.71 7\"/><path d=\"m7.5 4.27 9 5.15\"/>" },
  { id: "baby", label: "Kids", Comp: Baby, svg: "<path d=\"M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5\"/><path d=\"M15 12h.01\"/><path d=\"M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1\"/><path d=\"M9 12h.01\"/>" },
  { id: "dog", label: "Pets", Comp: Dog, svg: "<path d=\"M11.25 16.25h1.5L12 17z\"/><path d=\"M16 14v.5\"/><path d=\"M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309\"/><path d=\"M8 14v.5\"/><path d=\"M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5\"/>" },
  { id: "land-plot", label: "Field / area", Comp: LandPlot, svg: "<path d=\"m12 8 6-3-6-3v10\"/><path d=\"m8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16 12\"/><path d=\"m6.49 12.85 11.02 6.3\"/><path d=\"M17.51 12.85 6.5 19.15\"/>" },
  { id: "megaphone", label: "Announcements", Comp: Megaphone, svg: "<path d=\"M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z\"/><path d=\"M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14\"/><path d=\"M8 6v8\"/>" },
  { id: "ticket", label: "Tickets", Comp: Ticket, svg: "<path d=\"M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z\"/><path d=\"M13 5v2\"/><path d=\"M13 17v2\"/><path d=\"M13 11v2\"/>" },
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
