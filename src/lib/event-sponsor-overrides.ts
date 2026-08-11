import mg from "@/assets/sponsors/mg-investments.png.asset.json";
import upc from "@/assets/sponsors/universal-power.png.asset.json";
import gm from "@/assets/sponsors/green-motion.png.asset.json";
import ecm from "@/assets/sponsors/eastern-cape-motors.png.asset.json";
import cycleLab from "@/assets/sponsors/cycle-lab.png.asset.json";
import tsitsikamma from "@/assets/sponsors/tsitsikamma.png.asset.json";
import kazin from "@/assets/sponsors/kazin.png.asset.json";
import kranzle from "@/assets/sponsors/kranzle.png.asset.json";
import squirt from "@/assets/sponsors/squirt.png.asset.json";
import customConstruction from "@/assets/sponsors/custom-construction.png.asset.json";

export type CuratedSponsor = {
  name: string;
  logoUrl: string;
  url: string;
};

export type CuratedSponsors = {
  title: CuratedSponsor;
  partners: CuratedSponsor[];
};

const TITLE_SPONSOR: CuratedSponsor = {
  name: "M&G Investments",
  logoUrl: mg.url,
  url: "https://www.mandg.co.za/",
};

const PARTNERS: CuratedSponsor[] = [
  {
    name: "Universal Power Corporation",
    logoUrl: upc.url,
    url: "https://www.universalpower.co.za/",
  },
  {
    name: "Green Motion Car and Van Rental",
    logoUrl: gm.url,
    url: "https://www.greenmotion.com/",
  },
  {
    name: "Eastern Cape Motors William Moffett",
    logoUrl: ecm.url,
    url: "https://www.easterncapemotors.co.za/",
  },
  { name: "Cycle Lab", logoUrl: cycleLab.url, url: "https://www.cyclelab.com/" },
  {
    name: "Tsitsikamma Natural Spring Water",
    logoUrl: tsitsikamma.url,
    url: "https://tsitsikammawater.co.za/",
  },
  { name: "Kazin Sales & Rentals", logoUrl: kazin.url, url: "https://www.kazin.co.za/" },
  { name: "Kränzle", logoUrl: kranzle.url, url: "https://www.kranzle.com/" },
  { name: "Squirt Cycling Products", logoUrl: squirt.url, url: "https://squirtcyclingproducts.com/" },
  {
    name: "Custom Construction",
    logoUrl: customConstruction.url,
    url: "https://www.google.com/search?q=Custom+Construction+Port+Elizabeth",
  },
];

const RCE_SET: CuratedSponsors = { title: TITLE_SPONSOR, partners: PARTNERS };

/** Curated sponsor sets keyed by a match on the event name. */
export function curatedSponsorsFor(eventName: string | null | undefined): CuratedSponsors | null {
  const n = (eventName ?? "").toLowerCase();
  if (n.includes("addo")) return RCE_SET;
  if (n.includes("plett") || n.includes("pe-plett") || n.includes("pe plett")) return RCE_SET;
  return null;
}
