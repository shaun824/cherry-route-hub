import { isEventRidingDate, type ResultsIssue } from './results-anomalies'

/** Fixed recipient; one specific event report, never a rider mailing list. */
export async function emailResultsIssues(eventId: string, eventName: string, issues: ResultsIssue[], now = new Date()) {
  if (!issues.length) return { sent: false, reason: 'no_issues' }
  const canonical = issues.map(i => JSON.stringify(i)).sort().join('\n')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(now)
  const { sendTemplateEmail } = await import('./email-templates/send-email')
  return sendTemplateEmail('results-issues', 'shaun@redcherryevents.co.za', {
    idempotencyKey: `results-issues:${eventId}:${date}:${hash}`,
    templateData: { eventName, issues, checkedAt: now.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) + ' SAST' },
  })
}

/** Reuses the existing hourly job. Only riding dates are eligible; identical daily reports dedupe. */
export async function checkEventDayResults(now = new Date()) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: events, error } = await supabaseAdmin.from('events').select('id,name,days,myriad_race_id,podium_config').not('myriad_race_id', 'is', null).neq('status', 'archived')
  if (error) throw new Error(error.message)
  const { computePodium } = await import('./podium.server')
  const outcomes = []
  for (const event of events ?? []) {
    if (!isEventRidingDate(event.days, now)) continue
    try {
      const review = await computePodium(event.id, 1000)
      if (!review) continue
      // Empty results before anyone has finished are expected, not an incident.
      if (!review.stagesWithResults && now.getUTCHours() < 14) continue
      const result = await emailResultsIssues(event.id, event.name, review.issues, now)
      outcomes.push({ eventId: event.id, issues: review.issues.length, ...result })
    } catch (error) {
      console.error('[results-review]', event.id, error)
      outcomes.push({ eventId: event.id, error: error instanceof Error ? error.message : 'Check failed' })
    }
  }
  return outcomes
}