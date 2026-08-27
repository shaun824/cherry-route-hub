// Server-only: reads email delivery history and renders template previews.
import * as React from 'react'
import { render } from '@react-email/render'
import { listEmailLogs } from '@lovable.dev/email-js'
import { TEMPLATES } from './email-templates/registry'

export type EmailLogRow = {
  timestamp: string
  recipient: string
  event_type: string
  status: string | null
  message_id: string | null
  tags: string[]
}

export type EmailLogResult = {
  rows: EmailLogRow[]
  history_starts_at: string
  has_more: boolean
}

export type EmailTemplateInfo = {
  name: string
  displayName: string
  subject: string
}

export async function fetchEmailLogs(input: {
  recipient?: string
  eventType?: string
  since?: string
  limit?: number
}): Promise<EmailLogResult> {
  const apiKey = process.env['LOVABLE_API_KEY']
  if (!apiKey) throw new Error('Email logs are not configured')

  const filters: Record<string, unknown> = { limit: Math.min(Math.max(input.limit ?? 100, 1), 100) }
  if (input.recipient) filters['recipient'] = input.recipient
  if (input.eventType) filters['event_type'] = input.eventType
  if (input.since) filters['since'] = input.since

  const res = await listEmailLogs(filters, { apiKey })
  return {
    rows: (res.data ?? []).map((e) => ({
      timestamp: e.timestamp,
      recipient: e.recipient,
      event_type: e.event_type,
      status: e.status ?? null,
      message_id: e.message_id ?? null,
      tags: e.tags ?? [],
    })),
    history_starts_at: res.history_starts_at,
    has_more: Boolean(res.pagination?.has_more),
  }
}

export function listTemplates(): EmailTemplateInfo[] {
  return Object.entries(TEMPLATES).map(([name, t]) => ({
    name,
    displayName: t.displayName ?? name,
    subject: typeof t.subject === 'function' ? t.subject(t.previewData ?? {}) : t.subject,
  }))
}

export async function renderTemplateHtml(name: string): Promise<{ html: string; subject: string }> {
  const template = TEMPLATES[name]
  if (!template) throw new Error(`Unknown email template: ${name}`)
  const data = template.previewData ?? {}
  const html = await render(React.createElement(template.component, data))
  const subject = typeof template.subject === 'function' ? template.subject(data) : template.subject
  return { html, subject }
}

export type SentEmailRow = {
  id: string
  recipient: string
  template: string
  subject: string
  sent_at: string
  suppressed: boolean
  opened_at: string | null
  last_opened_at: string | null
  open_count: number
  click_count: number
}

export type SentEmailDetail = SentEmailRow & {
  html: string
  clicks: { url: string; clicked_at: string }[]
}

export async function fetchSentEmails(input: { recipient?: string; template?: string; limit?: number }) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const admin = supabaseAdmin as any
  let q = admin
    .from('email_sends')
    .select('id, recipient, template, subject, sent_at, suppressed, opened_at, last_opened_at, open_count, click_count')
    .order('sent_at', { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 200))
  if (input.recipient) q = q.ilike('recipient', `%${input.recipient}%`)
  if (input.template) q = q.eq('template', input.template)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as SentEmailRow[]
}

export async function fetchSentEmail(id: string): Promise<SentEmailDetail> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const admin = supabaseAdmin as any
  const { data, error } = await admin.from('email_sends').select('*').eq('id', id).single()
  if (error) throw error
  const { data: clicks } = await admin
    .from('email_send_clicks')
    .select('url, clicked_at')
    .eq('send_id', id)
    .order('clicked_at', { ascending: false })
  return { ...(data as SentEmailRow & { html: string }), clicks: (clicks ?? []) as { url: string; clicked_at: string }[] }
}
