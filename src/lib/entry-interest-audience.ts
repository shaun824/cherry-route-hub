export const ENTRY_ALERT_LIST = '145818';
export const BICYCLES_LIST = '102600';
export function mayAddMembership(contact: { status?: string; email_status?: string }, mapping: unknown) {
  return contact.status === 'on' && ['none', 'on', 'subscribed', 'confirmed'].includes(contact.email_status ?? '') && mapping === null;
}