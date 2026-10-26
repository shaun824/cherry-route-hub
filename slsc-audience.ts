import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { everlyticRequest } from '@/lib/everlytic.server'
import { BICYCLES_LIST, mayAddMembership, newEntryInterestContact } from '@/lib/entry-interest-audience'

const username = process.env.EVERLYTIC_USERNAME!
const apiKey = process.env.EVERLYTIC_API_KEY!
const EVENT_IDS = [
  '7c1a2b01-5c26-4e01-9a01-000000000001',
  '7c1a2b01-5c26-4e01-9a01-000000000002',
  '7c1a2b01-5c26-4e01-9a01-000000000003',
  '7c1a2b01-5c26-4e01-9a01-000000000004',
]

const { data: links, error } = await supabaseAdmin
  .from('event_entrants')
  .select('entrant_id')
  .in('event_id', EVENT_IDS)
if (error) throw error
const entrantIds = [...new Set((links ?? []).map((l) => l.entrant_id as string))]

const { data: entrants, error: eErr } = await supabaseAdmin
  .from('entrants')
  .select('id, full_name, email')
  .in('id', entrantIds)
if (eErr) throw eErr

const emails = [...new Set((entrants ?? []).map((e) => String(e.email ?? '').trim().toLowerCase()).filter((e) => e.includes('@')))]
console.log(`unique entrant emails: ${emails.length}`)

let added = 0, already = 0, skipped = 0, failed = 0
for (const email of emails) {
  try {
    const lookup = async () => {
      const raw = await everlyticRequest(`/api/2.0/contacts?filters[email]=${encodeURIComponent(email)}&count=25`, 'GET', username, apiKey)
      return (raw.collection ?? []).map((i: any) => i.data ?? i).find((c: any) => String(c.email).toLowerCase() === email)
    }
    let contact = await lookup()
    if (!contact) {
      await everlyticRequest('/api/2.0/contacts', 'POST', username, apiKey, newEntryInterestContact(email))
      contact = await lookup()
    }
    if (!contact?.id) { failed++; console.log(`no contact: ${email}`); continue }
    let mapping = null
    try {
      mapping = await everlyticRequest(`/api/2.0/list_subscriptions/${BICYCLES_LIST}/${contact.id}`, 'GET', username, apiKey)
    } catch (err: any) {
      if (err?.status !== 404) throw err
    }
    if (mapping) { already++; continue }
    if (!mayAddMembership(contact, null)) { skipped++; console.log(`skipped (status): ${email}`); continue }
    await everlyticRequest(`/api/2.0/list_subscriptions/${BICYCLES_LIST}`, 'POST', username, apiKey, { contact_id: contact.id, email_status: 'subscribed' })
    added++
  } catch (err) {
    failed++
    console.log(`failed: ${email} ${String(err).slice(0, 120)}`)
  }
}
console.log(`done: added=${added} already=${already} skipped=${skipped} failed=${failed}`)
