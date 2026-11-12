import * as React from 'react'
import { Heading, Text } from '@react-email/components'

import { EmailShell, brand, h1, text } from './theme'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  email?: string
  phone?: string | null
  trip?: string
  message?: string
  consent?: boolean
  receivedAt?: string
}

const label = { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '1px', color: '#009CA6', fontWeight: 700 as const, margin: '0 0 4px' }
const value = { ...text, margin: '0 0 16px', color: brand.ink }
const body = { ...value, whiteSpace: 'pre-wrap' as const, backgroundColor: '#F3FAFA', border: `1px solid ${brand.border}`, borderRadius: '10px', padding: '16px' }

const Email = ({ name = '', email = '', phone, trip = 'Not sure yet', message = '', consent = false, receivedAt }: Props) => (
  <EmailShell preview={`New Tour de Addo enquiry from ${name}`} siteName="M&G Investments Tour de Addo" theme={{ barBackground: '#009CA6', brandColor: '#009CA6' }}>
    <Heading style={h1}>New website enquiry</Heading>
    <Text style={text}>Reply to this email to answer {name || 'the rider'} directly.</Text>
    <Text style={label}>Name</Text><Text style={value}>{name}</Text>
    <Text style={label}>Email</Text><Text style={value}>{email}</Text>
    <Text style={label}>Phone</Text><Text style={value}>{phone || 'Not given'}</Text>
    <Text style={label}>Trip</Text><Text style={value}>{trip}</Text>
    <Text style={label}>Question</Text><Text style={body}>{message}</Text>
    <Text style={label}>News and next-event emails</Text><Text style={value}>{consent ? 'Yes, added to Everlytic' : 'No'}</Text>
    {receivedAt ? <Text style={{ ...text, fontSize: '12px' }}>Received {new Date(receivedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</Text> : null}
  </EmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Tour de Addo enquiry: ${d?.trip ?? 'Not sure yet'} · ${d?.name ?? ''}`,
  displayName: 'Tour de Addo website enquiry (team)',
  to: 'team@redcherryevents.co.za',
  previewData: { name: 'Sam Rider', email: 'sam@example.com', phone: '082 000 0000', trip: 'Best of Nyati 18–21 August 2027', message: 'Is the Nyati trip OK for a first-timer?', consent: true, receivedAt: '2026-11-12T10:00:00Z' },
} satisfies TemplateEntry
