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
import herotel from "@/assets/sponsors/herotel.png.asset.json";
import quinton from "@/assets/sponsors/quinton.png.asset.json";
import nutriGo from "@/assets/sponsors/nutri-go.png.asset.json";
import rudy from "@/assets/sponsors/rudy-project.png.asset.json";
import buco from "@/assets/sponsors/buco.png.asset.json";
import enjoy from "@/assets/sponsors/enjoy.png.asset.json";
import plettRealty from "@/assets/sponsors/plett-realty.jpg.asset.json";
import doolhof from "@/assets/sponsors/doolhof.png.asset.json";
import knysnaRealty from "@/assets/sponsors/knysna-realty.jpg.asset.json";
import otto1890 from "@/assets/sponsors/otto1890.png.asset.json";
import westvaal from "@/assets/sponsors/westvaal.png.asset.json";
import triumphCt from "@/assets/sponsors/triumph-cape-town.png.asset.json";
import sab from "@/assets/sponsors/sab.png.asset.json";
import isuzu from "@/assets/sponsors/isuzu.png.asset.json";
import hyperclear from "@/assets/sponsors/hyperclear.png.asset.json";
import peninsulaPower from "@/assets/sponsors/peninsula-power.png.asset.json";
import redCherry from "@/assets/sponsors/red-cherry-events.png.asset.json";

export type CuratedSponsor = {
  name: string;
  logoUrl: string;
  url: string;
};

export type CuratedSponsors = {
  title: CuratedSponsor;
  partners: CuratedSponsor[];
  /** Third-tier supporters, shown in their own rolling marquee. */
  supporters?: CuratedSponsor[];
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
  { name: "Herotel", logoUrl: herotel.url, url: "https://herotel.com/" },
  { name: "Quinton", logoUrl: quinton.url, url: "https://www.quinton.co.za/" },
  { name: "Nutri-Go", logoUrl: nutriGo.url, url: "https://nutrigo.co.za/" },
  { name: "Rudy Project", logoUrl: rudy.url, url: "https://www.rudyproject.co.za/" },
  { name: "BUCO", logoUrl: buco.url, url: "https://www.buco.co.za/" },
  { name: "Enjoy", logoUrl: enjoy.url, url: "https://www.google.com/search?q=Enjoy+brand" },
  { name: "Plett Realty", logoUrl: plettRealty.url, url: "https://www.plettrealty.co.za/" },
  { name: "Doolhof Wine Estate", logoUrl: doolhof.url, url: "https://www.doolhof.com/" },
  { name: "Knysna Realty", logoUrl: knysnaRealty.url, url: "https://www.knysnarealty.co.za/" },
];

const RCE_SET: CuratedSponsors = { title: TITLE_SPONSOR, partners: PARTNERS };

const WEEKEND_WARRIOR_SET: CuratedSponsors = {
  title: {
    name: "Otto 1890 Investment Specialists",
    logoUrl: otto1890.url,
    url: "https://otto1890.co.za/",
  },
  partners: [
    { name: "Cycle Lab", logoUrl: cycleLab.url, url: "https://www.cyclelab.com/" },
    {
      name: "Westvaal Motor Group",
      logoUrl: westvaal.url,
      url: "https://www.westvaal.co.za/",
    },
    {
      name: "Green Motion Car and Van Rental",
      logoUrl: gm.url,
      url: "https://www.greenmotion.com/",
    },
  ],
  supporters: [
    { name: "Triumph Cape Town", logoUrl: triumphCt.url, url: "https://www.triumphcapetown.co.za/" },
    { name: "Squirt Cycling Products", logoUrl: squirt.url, url: "https://squirtcyclingproducts.com/" },
    { name: "SAB", logoUrl: sab.url, url: "https://www.sab.co.za/" },
    { name: "Isuzu", logoUrl: isuzu.url, url: "https://www.isuzu.co.za/" },
    { name: "Hyperclear", logoUrl: hyperclear.url, url: "https://www.hyperclear.co.za/" },
    { name: "Rudy Project", logoUrl: rudy.url, url: "https://www.rudyproject.co.za/" },
    { name: "Kazin Sales & Rentals", logoUrl: kazin.url, url: "https://www.kazin.co.za/" },
    { name: "Peninsula Power Products", logoUrl: peninsulaPower.url, url: "https://www.peninsulapower.co.za/" },
    { name: "Red Cherry Events", logoUrl: redCherry.url, url: "https://www.redcherryevents.co.za/" },
  ],
};

/** Curated sponsor sets keyed by a match on the event name. */
export function curatedSponsorsFor(eventName: string | null | undefined): CuratedSponsors | null {
  const n = (eventName ?? "").toLowerCase();
  if (n.includes("weekend warrior") || n.includes("weekend-warrior")) return WEEKEND_WARRIOR_SET;
  if (n.includes("addo")) return RCE_SET;
  if (n.includes("plett") || n.includes("pe-plett") || n.includes("pe plett")) return RCE_SET;
  return null;
}
