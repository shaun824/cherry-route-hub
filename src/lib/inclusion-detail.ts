// Deep detail for a single entry inclusion / merchandise item: what it is,
// exactly what's included, when you can access it, where it lives in the
// village and how to find it once you're inside.
//
// The website-scraped description (event_merch_options.description) always
// wins for the "what it is" paragraph — this file supplies the structured
// detail the website never spells out.
import type { VillageCategory, VillageHotspot } from "@/lib/village-map";
import type { ScheduleItem } from "@/lib/mock-data";

export type InclusionDetail = {
  /** Bullet list: exactly what the rider receives. */
  included: string[];
  /** Bullet list: the practical stuff people always ask. */
  goodToKnow: string[];
  /** Where in the village this lives, in plain words. */
  wherePlain: string;
  /** Village hotspot categories that serve this inclusion. */
  categories: VillageCategory[];
  /** Matches hotspot titles / schedule lines that relate to this inclusion. */
  match: RegExp;
};

type Rule = { test: RegExp; detail: InclusionDetail };

const REG_DETAIL: InclusionDetail = {
  included: [],
  goodToKnow: [],
  wherePlain: "Registration marquee in the rider village.",
  categories: ["registration"],
  match: /registration|register|race pack|check[- ]?in|number|briefing/i,
};

const RULES: Rule[] = [
  {
    test: /riding top|race fit|jersey|cycling top|t[\s-]?shirt|tee\b|golf ?shirt|vest|cap|beanie|sock|jacket|softshell|windbreaker/i,
    detail: {
      included: [
        "One Enjoy-branded garment per rider in the exact size chosen on your Entry Ninja entry.",
        "Official event artwork with the current year's sponsor set, produced by Enjoy.",
        "Packed into your rider bag with your number board and timing chip.",
      ],
      goodToKnow: [
        "Try it on at the Enjoy merch stand before you leave the venue — size swaps are only possible on the day, while stock lasts.",
        "Sizes are locked a few weeks before the event when we place the Enjoy order, so change yours on Entry Ninja early.",
        "Extra garments can be bought from Enjoy at the merch stand if stock allows.",
      ],
      wherePlain: "Collected at the registration marquee, swaps at the Enjoy merchandise stand.",
      categories: ["registration", "shop"],
      match: /registration|merch|apparel|shop|kit|enjoy/i,

    },
  },
  {
    test: /e[\s-]?bike rental|bike rental|bike hire|rental bike/i,
    detail: {
      included: [
        "A serviced rental bike reserved in your frame size for the full event.",
        "Basic set-up and saddle-height fit when you collect it.",
        "Support from the rental team for mechanicals during the event.",
      ],
      goodToKnow: [
        "Bring your own pedals, shoes and helmet — those are never included.",
        "Collect during registration hours; late arrivals must call the rental team.",
        "Damage beyond fair wear is billed to you, so give it a quick check before you ride off.",
      ],
      wherePlain: "Rental gazebo next to the bike park / tech area.",
      categories: ["bike", "registration"],
      match: /rental|hire|bike park|tech|workshop|mechanic/i,
    },
  },
  {
    test: /bike wash|wash/i,
    detail: {
      included: [
        "A pressure wash of your bike after each stage, every day of the event.",
        "Chain lube and a quick drivetrain wipe-down before it goes back on the rack.",
      ],
      goodToKnow: [
        "Drop the bike straight after your finish — queues build up an hour after the leaders arrive.",
        "Take your computer, lights and saddle bag off first.",
        "Washed bikes are returned to the numbered bike park, not to your tent.",
      ],
      wherePlain: "Bike wash bay, usually behind the bike park near the finish.",
      categories: ["bike"],
      match: /wash|bike park|bike/i,
    },
  },
  {
    test: /bike service|service|mechanic|workshop|tech/i,
    detail: {
      included: [
        "Mechanical check and tune by the event workshop.",
        "Labour covered for the standard service.",
      ],
      goodToKnow: [
        "Parts, tyres and consumables are billed on the day — card and cash accepted.",
        "Book your bike in the evening before if you want it ready for the morning start.",
      ],
      wherePlain: "Tech tent alongside the bike park.",
      categories: ["bike"],
      match: /tech|workshop|mechanic|service|bike park/i,
    },
  },
  {
    test: /licen[cs]e|csa|msa|day licence/i,
    detail: {
      included: ["A temporary day licence so you're insured and eligible to start."],
      goodToKnow: [
        "Bring your ID — we cannot issue a licence without it.",
        "Annual licence holders should bring their card instead; no need to buy a day licence.",
      ],
      wherePlain: "Licence desk inside the registration marquee.",
      categories: ["registration"],
      match: /registration|licen/i,
    },
  },
  {
    test: /dietary|diet|allerg|vegetarian|vegan|halaal|gluten/i,
    detail: {
      included: ["Your dietary requirement flagged with the catering team for every meal included in your package."],
      goodToKnow: [
        "Introduce yourself to the chef at the first meal — they plate your meals separately.",
        "Severe allergies: tell the info desk at registration as well so the whole team knows.",
      ],
      wherePlain: "Main catering marquee in the village.",
      categories: ["food"],
      match: /food|catering|marquee|dining|meal/i,
    },
  },
  {
    test: /breakfast|dinner|lunch|meal|catering|braai|buffet/i,
    detail: {
      included: [
        "Buffet-style meals for the days covered by your package.",
        "Coffee, tea and water throughout service.",
      ],
      goodToKnow: [
        "Your wristband is your meal ticket — wear it for the whole event.",
        "Serving times are on the daily schedule below; the kitchen closes on time.",
        "Guests and supporters need a spectator meal ticket, bought at the info desk.",
      ],
      wherePlain: "Main catering marquee in the village.",
      categories: ["food"],
      match: /food|catering|marquee|dining|breakfast|dinner|lunch|meal/i,
    },
  },
  {
    test: /vehicle transfer|car transfer|transfer service|luggage transfer|bag transfer/i,
    detail: {
      included: [
        "We move your vehicle or kit bags between villages while you ride.",
        "Your bag is dropped at the next village before you arrive.",
      ],
      goodToKnow: [
        "One clearly labelled bag per rider — mark it with your race number.",
        "Hand keys or bags in at the logistics desk by the cut-off on the schedule; late bags travel on the sweep vehicle.",
        "Keep valuables, medication and riding kit with you, not in the transfer bag.",
      ],
      wherePlain: "Logistics / baggage desk near the village entrance.",
      categories: ["registration", "parking"],
      match: /logistics|baggage|luggage|transfer|entrance|parking/i,
    },
  },
  {
    test: /shuttle|transport|airport|no hassle/i,
    detail: {
      included: [
        "Door-to-door logistics for you and your bike to the start and home again.",
        "Bike handled by our crew in a padded transporter.",
      ],
      goodToKnow: [
        "Collection points and times are confirmed by email the week before the event.",
        "Be at the pick-up point 15 minutes early — the shuttle cannot wait.",
      ],
      wherePlain: "Shuttle drop-off at the village entrance / parking area.",
      categories: ["parking"],
      match: /shuttle|transport|parking|entrance|drop/i,
    },
  },
  {
    test: /chalet|hotel|lodge|room|single room|accommodation|housed|sharing/i,
    detail: {
      included: [
        "Your allocated bed for the nights covered by your package.",
        "Linen and towels where the venue provides them.",
      ],
      goodToKnow: [
        "Your room or tent number appears on this page once the rooming list is final.",
        "Check in at the village desk before you go looking for your room.",
        "Sharing requests must be made on Entry Ninja before the rooming list closes.",
      ],
      wherePlain: "Accommodation zone of the village — use the map to walk straight to it.",
      categories: ["camping", "registration"],
      match: /accommodation|room|tent|camp|check[- ]?in|reception/i,
    },
  },
  {
    test: /camp|tent/i,
    detail: {
      included: [
        "A pitched tent with a mattress in the rider village.",
        "Access to the shared ablutions and charging points in the village.",
      ],
      goodToKnow: [
        "Bring your own sleeping bag and pillow unless your package says otherwise.",
        "Your tent number shows on the village map here — tap it and it lights up your spot.",
        "Tents are pitched by the crew; don't move one without asking the village manager.",
      ],
      wherePlain: "Camping zone of the rider village.",
      categories: ["camping", "toilets"],
      match: /camp|tent|ablution|shower|toilet/i,
    },
  },
  {
    test: /spectator|guest|supporter|extra ticket|partner/i,
    detail: {
      included: [
        "Village access for your support crew, including the finish area.",
        "Meals where your package covers them.",
      ],
      goodToKnow: [
        "Collect their wristband with your race pack — they cannot collect it themselves.",
        "Under-12s are usually free; check at the info desk.",
      ],
      wherePlain: "Registration marquee, then anywhere in the public village.",
      categories: ["registration", "stage", "food"],
      match: /registration|spectator|finish|village|marquee/i,
    },
  },
  {
    test: /massage|physio|recovery/i,
    detail: {
      included: ["A recovery / massage session with the event physio team for each day it's included."],
      goodToKnow: [
        "Book your slot as soon as you finish — the late-afternoon slots go first.",
        "Bring a towel and arrive showered if you can.",
      ],
      wherePlain: "Recovery tent, usually beside the finish or the catering marquee.",
      categories: ["medical", "stage"],
      match: /recovery|physio|massage|medical/i,
    },
  },
  {
    test: /photo|image|gallery/i,
    detail: {
      included: ["All official photographs of you, shot by the event crew across the route and village."],
      goodToKnow: [
        "Wear your number board clearly on the front so the taggers can find your shots.",
        "Photos land in the Photos tab of this app a few days after the finish.",
      ],
      wherePlain: "On course and at the finish arch — nothing to collect.",
      categories: ["finish", "stage"],
      match: /photo|finish/i,
    },
  },
  {
    test: /bag|luggage|kit bag|entry pack|race pack/i,
    detail: {
      included: [
        "Your rider bag with race number board, timing chip, wristband and partner goodies.",
        "The event programme with schedule and emergency numbers.",
      ],
      goodToKnow: [
        "Bring your ID; someone else can only collect with a signed letter from you.",
        "Check your timing chip is in the bag before you leave the desk.",
      ],
      wherePlain: "Registration marquee.",
      categories: ["registration"],
      match: /registration|race pack|number|timing/i,
    },
  },
  {
    test: /beer|drink|wine|bar tab|refreshment/i,
    detail: {
      included: ["The drinks covered by your package, redeemed at the village bar."],
      goodToKnow: [
        "Show your wristband at the bar — no wristband, no drink.",
        "Bar hours are on the daily schedule; last round is strict on riding nights.",
      ],
      wherePlain: "Village bar / beer garden.",
      categories: ["bar"],
      match: /bar|beer|garden|drinks/i,
    },
  },
];

const DEFAULT_DETAIL: InclusionDetail = {
  included: ["Included with your entry package."],
  goodToKnow: [
    "Ask at the info desk in the registration marquee if you're unsure how to claim this.",
    "Anything added on Entry Ninja after entry syncs back to this page automatically.",
  ],
  wherePlain: "Registration marquee / info desk.",
  categories: ["registration"],
  match: REG_DETAIL.match,
};

export function inclusionDetail(name: string): InclusionDetail {
  for (const r of RULES) if (r.test.test(name)) return r.detail;
  return DEFAULT_DETAIL;
}

/** Village spots that serve this inclusion, best match first. */
export function matchingSpots(
  spots: VillageHotspot[],
  detail: InclusionDetail,
  name: string,
): VillageHotspot[] {
  const scored = spots
    .map((s) => {
      let score = 0;
      const text = `${s.title} ${s.description ?? ""}`;
      if (detail.match.test(text)) score += 3;
      if (detail.categories.includes(s.category)) score += 2;
      if (new RegExp(name.split(/\s+/).slice(0, 2).join("\\s+"), "i").test(s.title)) score += 2;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map((x) => x.s);
}

/** Schedule lines that mention this inclusion. */
export function matchingSchedule(
  schedule: ScheduleItem[],
  detail: InclusionDetail,
): ScheduleItem[] {
  return schedule
    .filter((i) => detail.match.test(`${i.label ?? ""} ${i.details ?? ""}`))
    .slice(0, 8);
}
