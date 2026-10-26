import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { syncEnEvent } from '@/lib/entryninja-sync.server'

const JOBS = [
  { enEventId: 83457, eventId: '7c1a2b01-5c26-4e01-9a01-000000000001' },
  { enEventId: 83458, eventId: '7c1a2b01-5c26-4e01-9a01-000000000002' },
  { enEventId: 83460, eventId: '7c1a2b01-5c26-4e01-9a01-000000000003' },
  { enEventId: 83461, eventId: '7c1a2b01-5c26-4e01-9a01-000000000004' },
]

for (const job of JOBS) {
  try {
    const result = await syncEnEvent(supabaseAdmin as never, job)
    console.log(JSON.stringify({ en: job.enEventId, total: result.totalEntries, created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors.slice(0, 3) }))
  } catch (error) {
    console.log(JSON.stringify({ en: job.enEventId, failed: String(error).slice(0, 200) }))
  }
}
console.log('sync done')
