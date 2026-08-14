import * as React from 'react'
import { Heading, Text } from '@react-email/components'

import { EmailShell, brand, h1, text } from './theme'
import type { TemplateEntry } from './registry'

interface Props {
  category?: string
  name?: string
  fromEmail?: string
  pagePath?: string
  message?: string
  userAgent?: string
}

const label = {
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  color: brand.blue,
  fontWeight: 700 as const,
  margin: '0 0 4px',
}

const value = { ...text, margin: '0 0 16px', color: brand.ink }

const body = {
  ...text,
  color: brand.ink,
  whiteSpace: 'pre-wrap' as const,
  backgroundColor: '#FAFAFC',
  border: `1px solid ${brand.border}`,
  borderRadius: '10px',
  padding: '16px',
}

const Email = ({
  category = 'issue',
  name,
  fromEmail,
  pagePath,
  message = '',
  userAgent,
}: Props) => (
  <EmailShell
    preview={`New rider feedback (${category})`}
    siteName="Red Cherry Events Rider Hub"
  >
    <Heading style={h1}>New rider feedback</Heading>

    <Text style={label}>Category</Text>
    <Text style={value}>{category}</Text>

    <Text style={label}>From</Text>
    <Text style={value}>
      {name || 'Anonymous'}
      {fromEmail ? ` — ${fromEmail}` : ''}
    </Text>

    <Text style={label}>Page</Text>
    <Text style={value}>{pagePath || 'unknown'}</Text>

    <Text style={label}>Message</Text>
    <Text style={body}>{message}</Text>

    {userAgent ? (
      <Text style={{ ...text, fontSize: '12px', margin: '16px 0 0' }}>
        {userAgent}
      </Text>
    ) : null}
  </EmailShell>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Rider Hub feedback (${data?.category ?? 'issue'})${data?.name ? ` — ${data.name}` : ''}`,
  displayName: 'Feedback notification',
  previewData: {
    category: 'issue',
    name: 'Jane Rider',
    fromEmail: 'jane@example.com',
    pagePath: '/my-events',
    message: 'The route profile on day 2 looks off.',
    userAgent: 'iPhone Safari',
  },
  to: 'team@redcherryevents.co.za',
} satisfies TemplateEntry
