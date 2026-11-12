import { z } from "zod";

// Tour de Addo website contact form (tourdeaddo.com). Shared, browser-safe rules.
export const TDA_ENQUIRY_ORIGINS = [
  "https://tourdeaddo.com",
  "https://www.tourdeaddo.com",
  "https://tour-de-addo.vercel.app",
] as const;

export const TDA_TRIPS = [
  "Not sure yet",
  "Best of Darlington Dam 22–25 April 2027",
  "Best of Darlington Dam 26–29 April 2027",
  "Best of Nyati 18–21 August 2027",
] as const;

/** Default Everlytic lists: "Enquiry - TDA" and the master "Bicycles" list. */
export const TDA_DEFAULT_LIST_IDS = ["102527", "102600"];
export const TDA_TEAM_EMAIL = "team@redcherryevents.co.za";

export function tdaListIds(raw: string | undefined | null): string[] {
  const ids = String(raw ?? "").split(",").map((s) => s.trim()).filter((s) => /^\d+$/.test(s));
  return ids.length ? ids : TDA_DEFAULT_LIST_IDS;
}

export function tdaCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && (TDA_ENQUIRY_ORIGINS as readonly string[]).includes(origin);
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin! } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function isAllowedTdaOrigin(origin: string | null) {
  return !!origin && (TDA_ENQUIRY_ORIGINS as readonly string[]).includes(origin);
}

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const tdaEnquirySchema = z.object({
  name: z.string({ error: "Please add your name." }).trim().min(1, "Please add your name.").max(120, "Your name is too long."),
  email: z.string({ error: "Please add your email address." }).trim().min(1, "Please add your email address.").max(255, "Your email address is too long.").email("Please check your email address.").transform((v) => v.toLowerCase()),
  phone: optional(40),
  trip: z.string().trim().optional().transform((v) => v || "Not sure yet").refine((v) => (TDA_TRIPS as readonly string[]).includes(v), "Please pick a trip from the list."),
  message: z.string({ error: "Please add your question." }).trim().min(1, "Please add your question.").max(4000, "Your question is too long."),
  consent: z.string().optional().transform((v) => v === "on" || v === "true" || v === "yes"),
});

export type TdaEnquiry = z.infer<typeof tdaEnquirySchema>;

export type TdaParse =
  | { kind: "honeypot" }
  | { kind: "invalid"; error: string }
  | { kind: "ok"; enquiry: TdaEnquiry };

/** Turns raw form fields into a checked enquiry. A filled honeypot is silently accepted. */
export function parseTdaEnquiry(fields: Record<string, unknown>): TdaParse {
  if (String(fields._gotcha ?? "").trim()) return { kind: "honeypot" };
  const pick = (k: string) => (typeof fields[k] === "string" ? (fields[k] as string) : fields[k] == null ? undefined : String(fields[k]));
  const result = tdaEnquirySchema.safeParse({
    name: pick("name"), email: pick("email"), phone: pick("phone"), trip: pick("trip"), message: pick("message"), consent: pick("consent"),
  });
  if (!result.success) return { kind: "invalid", error: result.error.issues[0]?.message ?? "Please check the form." };
  return { kind: "ok", enquiry: result.data };
}

/** Everlytic is only ever touched when the rider ticked the news box. */
export function shouldSyncToEverlytic(enquiry: Pick<TdaEnquiry, "consent">) {
  return enquiry.consent === true;
}
