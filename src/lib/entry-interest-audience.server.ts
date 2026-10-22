import { everlyticRequest } from './everlytic.server';
import { BICYCLES_LIST, ENTRY_ALERT_LIST, mayAddMembership, newEntryInterestContact } from './entry-interest-audience';

export async function syncEntryInterestAudience(email: string, username: string, apiKey: string) {
  async function lookup() {
    const raw = await everlyticRequest(`/api/2.0/contacts?filters[email]=${encodeURIComponent(email)}&count=25`, 'GET', username, apiKey);
    return (raw.collection ?? []).map((item: { data?: Record<string, unknown> }) => item.data ?? item).find((c: Record<string, unknown>) => String(c.email).toLowerCase() === email);
  }
  let contact = await lookup();
  if (!contact) {
    await everlyticRequest('/api/2.0/contacts', 'POST', username, apiKey, newEntryInterestContact(email));
    contact = await lookup();
  }
  if (!contact?.id) throw new Error('Could not verify mailing-list contact');
  async function membership(list: string) {
    try {
      return await everlyticRequest(`/api/2.0/list_subscriptions/${list}/${contact.id}`, 'GET', username, apiKey);
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) return null;
      throw error;
    }
  }
  for (const list of [ENTRY_ALERT_LIST, BICYCLES_LIST]) {
    const mapping = await membership(list);
    if (mayAddMembership(contact, mapping)) {
      await everlyticRequest(`/api/2.0/list_subscriptions/${list}`, 'POST', username, apiKey, { contact_id: contact.id, email_status: 'subscribed' });
      if (!(await membership(list))) throw new Error('Could not verify mailing-list membership');
    }
  }
  return { verified: true };
}