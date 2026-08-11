import mg from "@/assets/sponsors/mg-investments.png.asset.json";
import upc from "@/assets/sponsors/universal-power.png.asset.json";
import gm from "@/assets/sponsors/green-motion.png.asset.json";
import ecm from "@/assets/sponsors/eastern-cape-motors.png.asset.json";

export type CuratedSponsor = {
  name: string;
  logoUrl: string;
  url: string;
};

export type CuratedSponsors = {
  title: CuratedSponsor;
  partners: CuratedSponsor[];
};

const TOUR_DE_ADDO: CuratedSponsors = {
  title: {
    name: "M&G Investments",
    logoUrl: mg.url,
    url: "https://www.mandg.co.za/",
  },
  partners: [
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
  ],
};

/** Curated sponsor sets keyed by a match on the event name. */
export function curatedSponsorsFor(eventName: string | null | undefined): CuratedSponsors | null {
  const n = (eventName ?? "").toLowerCase();
  if (n.includes("addo")) return TOUR_DE_ADDO;
  return null;
}
