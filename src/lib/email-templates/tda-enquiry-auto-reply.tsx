import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'

import { EmailShell, brand, h1, text } from './theme'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  message?: string
}

const TEAL = '#009CA6'
const quote = { ...text, color: brand.ink, whiteSpace: 'pre-wrap' as const, backgroundColor: '#F3FAFA', borderLeft: `4px solid ${TEAL}`, borderRadius: '6px', padding: '12px 16px' }
const sub = { fontSize: '16px', fontWeight: 700 as const, color: brand.ink, margin: '8px 0 8px' }
const row = { ...text, margin: '0 0 6px', color: brand.ink }

const Email = ({ name, message = '' }: Props) => {
  const first = (name ?? '').trim().split(/\s+/)[0]
  return (
    <EmailShell preview="Thanks for your Tour de Addo question. We'll reply within 2 working days." siteName="M&G Investments Tour de Addo" theme={{ barBackground: TEAL, brandColor: TEAL }}>
      <Heading style={h1}>Thanks{first ? `, ${first}` : ''}. We've got your question.</Heading>
      <Text style={text}>Here's what you asked:</Text>
      <Text style={quote}>{message}</Text>
      <Text style={text}>Someone from the team will get back to you within 2 working days.</Text>

      <Text style={sub}>2027 trips</Text>
      <Text style={row}>Best of Darlington Dam: 22 to 25 April 2027</Text>
      <Text style={row}>Best of Darlington Dam: 26 to 29 April 2027</Text>
      <Text style={{ ...row, margin: '0 0 16px' }}>Best of Nyati: 18 to 21 August 2027</Text>
      <Text style={text}>Each tour takes 30 riders, and a R5 000 deposit secures your spot.</Text>

      <Section style={{ textAlign: 'center' as const, margin: '8px 0 20px' }}>
        <Button href="https://tourdeaddo.com/#book" style={{ backgroundColor: TEAL, color: '#ffffff', fontSize: '15px', fontWeight: 600, borderRadius: '10px', padding: '13px 28px', textDecoration: 'none' }}>
          Book 2027
        </Button>
      </Section>
      <Text style={text}>Prefer to talk? Call us on (041) 581 5335.</Text>
      <Text style={text}>The Red Cherry Events team</Text>
    </EmailShell>
  )
}

export const template = {
  component: Email,
  subject: 'Thanks for your Tour de Addo question',
  displayName: 'Tour de Addo website enquiry (rider reply)',
  previewData: { name: 'Sam Rider', message: 'Is the Nyati trip OK for a first-timer?' },
} satisfies TemplateEntry
