import type { PackingItem } from "./event-info";

export function normalisePackingTerms(items: PackingItem[]): PackingItem[] {
  return items.map((item) => ({ ...item, label: item.label.replace(/\bgaffer\s+tape\b/gi, "Duct Tape") }));
}

export function activityPackingList(name?: string | null): PackingItem[] | null {
  if (!name || !/^sabrina love/i.test(name)) return null;
  if (/MTB|E-Bike|mountain bike/i.test(name)) return null;
  const beach = /beach|surf ski|kayak/i.test(name);
  const category = beach ? "Beach day essentials" : "Run essentials";
  const items: PackingItem[] = [
    { key: "day-water", label: "Drinking water / hydration pack", category, essential: true },
    { key: "day-sunscreen", label: "Water-resistant SPF50 sunscreen and SPF lip balm", category, essential: true },
    { key: "day-hat", label: "Sun hat and sunglasses", category },
    { key: "day-snacks", label: "Snacks for the day", category },
    { key: "day-phone", label: "Fully charged phone in a waterproof pouch", category },
    { key: "day-medication", label: "Personal medication and blister plasters", category },
    { key: "day-registration", label: "Entry confirmation / race number", category },
  ];
  if (beach) {
    items.push(
      { key: "walk-shoes", label: "Comfortable walking shoes or beach sandals", category: "Beach walk", essential: true },
      { key: "walk-clothes", label: "Lightweight clothing and a sun-protective top", category: "Beach walk" },
      { key: "beach-towel", label: "Towel and dry change of clothes", category },
      { key: "paddle-craft", label: "Seaworthy surf ski / open-water kayak and paddle", category: "Surf ski / open-water kayak", essential: true },
      { key: "paddle-pfd", label: "Properly fitted personal flotation device (PFD)", category: "Surf ski / open-water kayak", essential: true },
      { key: "paddle-leash", label: "Craft leash suitable for open-water paddling", category: "Surf ski / open-water kayak", essential: true },
      { key: "paddle-whistle", label: "Safety whistle", category: "Surf ski / open-water kayak", essential: true },
      { key: "paddle-clothes", label: "Paddling kit / wetsuit suitable for the sea conditions", category: "Surf ski / open-water kayak" },
      { key: "paddle-drybag", label: "Dry bag for belongings", category: "Surf ski / open-water kayak" },
    );
  } else {
    items.push(
      { key: "run-shoes", label: "Running shoes suited to the course", category, essential: true },
      { key: "run-clothes", label: "Comfortable running kit and socks", category, essential: true },
      { key: "run-jacket", label: "Lightweight wind / rain jacket", category },
      { key: "run-change", label: "Towel and dry change of clothes", category },
    );
  }
  return items;
}