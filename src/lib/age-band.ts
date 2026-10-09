// Derives a coarse age band from a South African ID number (YYMMDD...).
// Only the band is ever stored — never the date of birth.
export type AgeBand = "U14" | "14-17" | "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+";

export function ageBandFromSaId(raw: string | null | undefined, now = new Date()): AgeBand | null {
  const id = (raw ?? "").replace(/\s+/g, "");
  if (!/^\d{13}$/.test(id)) return null;
  const yy = Number(id.slice(0, 2));
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const curYY = now.getFullYear() % 100;
  const year = yy > curYY ? 1900 + yy : 2000 + yy;
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < mm || (now.getMonth() + 1 === mm && now.getDate() < dd)) age--;
  if (age < 0 || age > 110) return null;
  if (age < 14) return "U14";
  if (age < 18) return "14-17";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
}

/** Normalises Entry Ninja gender strings to male/female/other. */
export function normaliseGender(raw: string | null | undefined): string | null {
  const g = (raw ?? "").trim().toLowerCase();
  if (!g) return null;
  if (g.startsWith("m")) return "male";
  if (g.startsWith("f") || g.startsWith("w")) return "female";
  return "other";
}
