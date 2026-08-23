// Turns a raw Entry Ninja extra / merchandise line into something a rider can
// actually understand: an icon, a plain-English blurb and how they get it at
// the event. Website-scraped descriptions (event_merch_options.description)
// always win over these fallbacks.

export type InclusionIcon =
  | "shirt"
  | "jacket"
  | "bike"
  | "wash"
  | "wrench"
  | "licence"
  | "meal"
  | "diet"
  | "transfer"
  | "shuttle"
  | "bed"
  | "tent"
  | "ticket"
  | "massage"
  | "photo"
  | "bag"
  | "beer"
  | "package";

export type InclusionMeta = {
  icon: InclusionIcon;
  /** What the item actually is. */
  blurb: string;
  /** How the rider gets it at the event. */
  howTo: string;
};

type Rule = { test: RegExp; meta: InclusionMeta };

const RULES: Rule[] = [
  {
    test: /riding top|race fit|jersey|cycling top/i,
    meta: {
      icon: "shirt",
      blurb: "Your official Enjoy riding top in the size you selected.",
      howTo: "Collect it with your race pack at registration — try it on before you leave the desk.",
    },
  },
  {
    test: /jacket|softshell|windbreaker/i,
    meta: {
      icon: "jacket",
      blurb: "Enjoy event jacket in your chosen size.",
      howTo: "Handed over in your rider bag at registration.",
    },
  },
  {
    test: /t[\s-]?shirt|tee\b|golf ?shirt|vest|cap|beanie|sock/i,
    meta: {
      icon: "shirt",
      blurb: "Enjoy event apparel in the size you chose on entry.",
      howTo: "In your race pack at registration. Sizes can be swapped at the Enjoy merch stand while stock lasts.",
    },
  },

  {
    test: /e[\s-]?bike rental|bike rental|bike hire|rental bike/i,
    meta: {
      icon: "bike",
      blurb: "A rental bike reserved in your frame size for the full event.",
      howTo: "Fitted and handed over at the rental gazebo at registration. Bring your own pedals, shoes and helmet.",
    },
  },
  {
    test: /bike wash|wash/i,
    meta: {
      icon: "wash",
      blurb: "Daily pressure wash of your bike after each stage.",
      howTo: "Drop your bike at the wash bay in the village when you finish — it comes back clean to the bike park.",
    },
  },
  {
    test: /bike service|service|mechanic|workshop/i,
    meta: {
      icon: "wrench",
      blurb: "Mechanical check and tune by the event workshop.",
      howTo: "Hand your bike in at the tech tent — labour is covered, parts are billed on the day.",
    },
  },
  {
    test: /licen[cs]e|csa|msa|day licence/i,
    meta: {
      icon: "licence",
      blurb: "Temporary racing licence so you're covered to start.",
      howTo: "Issued with your race number at registration — bring your ID.",
    },
  },
  {
    test: /dietary|diet|allerg|vegetarian|vegan|halaal|gluten/i,
    meta: {
      icon: "diet",
      blurb: "Your dietary requirement is flagged with our catering team.",
      howTo: "Tell the chef at the buffet — a marked plate is set aside for you at each meal.",
    },
  },
  {
    test: /breakfast|dinner|lunch|meal|catering|braai/i,
    meta: {
      icon: "meal",
      blurb: "Meals included in your package.",
      howTo: "Served in the main marquee — check the daily schedule for serving times.",
    },
  },
  {
    test: /vehicle transfer|car transfer|transfer service|luggage transfer/i,
    meta: {
      icon: "transfer",
      blurb: "We move your vehicle or bags between the villages for you.",
      howTo: "Hand your keys or bags in at the logistics desk at the times listed in the schedule.",
    },
  },
  {
    test: /shuttle|transport|airport|no hassle/i,
    meta: {
      icon: "shuttle",
      blurb: "Door-to-door logistics: your bike and you get to the start and home again.",
      howTo: "The logistics team will confirm collection points and times by email the week before.",
    },
  },
  {
    test: /chalet|hotel|lodge|room|single room|accommodation|housed/i,
    meta: {
      icon: "bed",
      blurb: "Your bed for the event, allocated by our rooming team.",
      howTo: "Room or tent number appears in this app once rooming lists are final — check-in at the village desk.",
    },
  },
  {
    test: /camp|tent/i,
    meta: {
      icon: "tent",
      blurb: "A pitched spot in the rider village.",
      howTo: "Your tent number shows on the village map in this app — follow it straight to your spot.",
    },
  },
  {
    test: /spectator|guest|supporter|extra ticket/i,
    meta: {
      icon: "ticket",
      blurb: "Access for your support crew to the village, meals and finish area.",
      howTo: "Collect their wristband with your race pack at registration.",
    },
  },
  {
    test: /massage|physio|recovery/i,
    meta: {
      icon: "massage",
      blurb: "Recovery session with the event physio team.",
      howTo: "Book your slot at the recovery tent when you arrive — slots go fast after each stage.",
    },
  },
  {
    test: /photo|image|gallery/i,
    meta: {
      icon: "photo",
      blurb: "Your event photos, shot by the official crew.",
      howTo: "Uploaded to the Photos tab in this app within a few days of the finish.",
    },
  },
  {
    test: /bag|luggage|kit bag|entry pack|race pack/i,
    meta: {
      icon: "bag",
      blurb: "Your rider bag with race number, timing chip and partner goodies.",
      howTo: "Collected at registration — bring your ID.",
    },
  },
  {
    test: /beer|drink|wine|bar tab/i,
    meta: {
      icon: "beer",
      blurb: "Drinks included with your package.",
      howTo: "Show your wristband at the village bar.",
    },
  },
];

const DEFAULT_META: InclusionMeta = {
  icon: "package",
  blurb: "Included with your entry.",
  howTo: "Sorted for you at registration — ask at the info desk if you're unsure.",
};

export function inclusionMeta(name: string): InclusionMeta {
  for (const rule of RULES) if (rule.test.test(name)) return rule.meta;
  return DEFAULT_META;
}

/** Normalised key used to match an entry line to the website merch catalogue. */
export function merchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/complimentary|official|event|per person|size/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Loose match: same key, or one key contains the other (min 6 chars). */
export function merchKeysMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 6 && b.includes(a)) return true;
  if (b.length >= 6 && a.includes(b)) return true;
  return false;
}
