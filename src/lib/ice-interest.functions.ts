import { createServerFn } from '@tanstack/react-start';
import { iceInterestSchema, iceInterestPayload } from './ice-interest';

export const subscribeIceInterest = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => iceInterestSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true };
    const key = process.env['EVENT_INTEREST_KEY'];
    if (!key) throw new Error('Sign-ups are temporarily unavailable. Please try again later.');
    const { handleEventInterest } = await import('./event-interest-handler.server');
    const response = await handleEventInterest(new Request('https://riderhub.redcherryevents.co.za/api/public/event-interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Event-Interest-Key': key },
      body: JSON.stringify(iceInterestPayload(data)),
    }));
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) throw new Error(result.error || 'Please try again.');
    return { ok: true };
  });