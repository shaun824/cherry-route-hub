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
