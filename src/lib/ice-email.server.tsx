import * as React from 'react';
import { render } from '@react-email/render';
import { template as raceWeek } from './email-templates/ice-race-week';
import { everlyticRequest } from './everlytic.server';

/** Fixed ICE opt-in message, sent via the owner's chosen marketing service. */
export async function sendIceRaceWeek(to: string, firstName: string | null, unsubscribeUrl: string) {
  const username = process.env['EVERLYTIC_USERNAME'];
  const apiKey = process.env['EVERLYTIC_API_KEY'];
  if (!username || !apiKey) throw new Error('Everlytic is not configured');
  const html = await render(React.createElement(raceWeek.component, { firstName, unsubscribeUrl }));
  const result = await everlyticRequest('/api/2.0/trans_mails', 'POST', username, apiKey, {
    headers: {
      from: { 'team@redcherryevents.co.za': 'Inner City Enduro' },
      reply_to: { 'team@redcherryevents.co.za': 'Red Cherry Events' },
      to: { [to]: firstName || 'ICE fan' },
      subject: raceWeek.subject,
      'trans-group-name': 'ICE 2026 race week',
    },
    body: { html },
    attachments: [],
    options: { track_opens: 'yes', track_links: 'yes' },
  });
  if (!result.transaction_id && !result.data?.transaction_id) throw new Error('Everlytic did not confirm the message');
  return { sent: true as const };
}