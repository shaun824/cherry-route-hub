import { z } from "zod";

export const eventInterestSignupSchema = z.object({
  eventId: z.string().uuid(),
  firstName: z.string().trim().min(1, "Please enter your first name").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(254),
  consent: z.literal(true, { error: "Please agree to receive event emails" }),
  website: z.string().max(200).default(""),
});
