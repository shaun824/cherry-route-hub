import * as React from 'react';
import { render } from '@react-email/render';
import { template as raceWeek } from './email-templates/ice-race-week';
import { everlyticRequest } from './everlytic.server';
import { ICE_MOTORBIKES_LIST_ID } from './ice-interest';

/** Fixed ICE opt-in message, sent via the owner's chosen marketing service. */
export async function sendIceRaceWeek(to: string, firstName: string | null, unsubscribeUrl: string) {
  const username = process.env['EVERLYTIC_USERNAME'];
  const apiKey = process.env['EVERLYTIC_API_KEY'];
  if (!username || !apiKey) throw new Error('Everlytic is not configured');
  const contacts = await everlyticRequest(`/api/2.0/contacts?filters[email]=${encodeURIComponent(to)}&count=25`, 'GET', username, apiKey);
  const contact = (contacts.collection ?? []).map((item: any) => item.data ?? item).find((item: any) => String(item.email).toLowerCase() === to.toLowerCase());
  if (!contact?.id) throw new Error('Could not verify the ICE mailing-list contact');
  const mapping = await everlyticRequest(`/api/2.0/list_subscriptions/${ICE_MOTORBIKES_LIST_ID}/${contact.id}`, 'GET', username, apiKey);
  const membership = mapping.item ?? mapping.data ?? mapping;
  const blocked = ['unsubscribed', 'bounced', 'complained'];
  if (contact.status === 'off' || blocked.includes(String(contact.email_status).toLowerCase()) || blocked.includes(String(membership.email_status).toLowerCase())) return { sent: false as const };
  if (!['subscribed', 'confirmed'].includes(String(membership.email_status).toLowerCase())) throw new Error('ICE mailing-list membership is not active');
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