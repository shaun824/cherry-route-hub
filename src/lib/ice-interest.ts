import { z } from 'zod';

export const ICE_EVENT_ID = 'f046ce38-e687-4038-959d-271ba20825f0';
export const ICE_MOTORBIKES_LIST_ID = '97023';
export const ICE_RACE_WEEK_SEND_AT = '2026-11-24T07:00:00.000Z';

export const iceInterestSchema = z.object({
  firstName: z.string().trim().min(1, 'Please enter your first name').max(80),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address').max(254),
  consent: z.literal(true, { error: 'Please agree to receive the emails' }),
  website: z.string().max(200).default(''),
});

export function iceInterestPayload(input: z.infer<typeof iceInterestSchema>) {
  return {
    event_id: ICE_EVENT_ID,
    name: input.firstName,
    email: input.email,
    consent: input.consent,
    website: input.website,
    source: 'innercityenduro.co.za website sign-up',
  };
}