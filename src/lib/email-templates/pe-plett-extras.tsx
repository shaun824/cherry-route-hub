import * as React from 'react'
import { Button, Heading, Link, Section, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { EmailShell, brand, button, footer, h1, link, text } from './theme'

export interface PePlettExtra {
  name: string
  option?: string | null
  quantity?: number
  price?: string | null
  description: string
  redeem: string
}

export interface PePlettExtrasEmailProps {
  firstName?: string
  eventName: string
  bookedExtras: PePlettExtra[]
  availableExtras: PePlettExtra[]
  registrationUrl: string
  extrasUrl?: string
}

const card = {
  backgroundColor: '#FAFAFC',
  border: `1px solid ${brand.border}`,
  borderRadius: '12px',
  padding: '18px 20px',
  margin: '0 0 14px',
}

const bookedCard = {
  ...card,
  borderLeft: `4px solid ${brand.green}`,
}

const availableCard = {
  ...card,
  borderLeft: `4px solid ${brand.orange}`,
}

const eyebrow = {
  color: brand.muted,
  fontSize: '11px',
  fontWeight: 700 as const,
  letterSpacing: '1.2px',
  margin: '26px 0 10px',
  textTransform: 'uppercase' as const,
}

const itemTitle = {
  color: brand.ink,
  fontSize: '17px',
  fontWeight: 700 as const,
  lineHeight: '1.35',
  margin: '0 0 6px',
}

const itemMeta = {
  color: brand.orange,
  fontSize: '13px',
  fontWeight: 700 as const,
  lineHeight: '1.45',
  margin: '0 0 8px',
}

const itemCopy = {
  color: brand.muted,
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 8px',
}

const redeem = {
  backgroundColor: '#FFF4EA',
  borderRadius: '8px',
  color: brand.ink,
  fontSize: '13px',
  lineHeight: '1.55',
  margin: '10px 0 0',
  padding: '10px 12px',
}

function ExtraCard({ item, booked }: { item: PePlettExtra; booked: boolean }) {
  const details = [
    item.quantity && item.quantity > 1 ? `Qty ${item.quantity}` : null,
    item.option,
    item.price,
  ].filter(Boolean)

  return (
    <Section style={booked ? bookedCard : availableCard}>
      <Text style={itemTitle}>{item.name}</Text>
      {details.length ? <Text style={itemMeta}>{details.join(' · ')}</Text> : null}
      <Text style={itemCopy}>{item.description}</Text>
      <Text style={redeem}>
        <strong>{booked ? 'How to use it:' : 'How it works:'}</strong> {item.redeem}
      </Text>
    </Section>
  )
}

export const PePlettExtrasEmail = ({
  firstName,
  eventName,
  bookedExtras,
  availableExtras,
  registrationUrl,
  extrasUrl = 'https://peplett.co.za/optional-extras/',
}: PePlettExtrasEmailProps) => (
  <EmailShell
    preview={`Your booked extras for ${eventName}, plus everything you need to use them`}
    siteName="M&G Investments PE Plett"
  >
    <Heading style={h1}>{firstName ? `${firstName}, your extras are sorted` : 'Your extras are sorted'}</Heading>
    <Text style={text}>
      Here is what is currently booked on your <strong>{eventName}</strong> entry, what each item
      includes, and exactly what to do at the event.
    </Text>

    <Text style={eyebrow}>Booked on your entry</Text>
    {bookedExtras.length ? (
      bookedExtras.map((item, index) => <ExtraCard key={`${item.name}-${index}`} item={item} booked />)
    ) : (
      <Section style={card}>
        <Text style={{ ...itemCopy, margin: '0' }}>
          No optional extras are currently showing on your synced entry. Open your registration to
          check or add them.
        </Text>
      </Section>
    )}

    <Button style={button} href={registrationUrl}>View or update my entry</Button>

    <Text style={eyebrow}>Other extras you can still book</Text>
    {availableExtras.length ? (
      availableExtras.map((item, index) => (
        <ExtraCard key={`${item.name}-${index}`} item={item} booked={false} />
      ))
    ) : (
      <Section style={card}>
        <Text style={{ ...itemCopy, margin: '0' }}>
          Your entry includes every extra currently listed. You can still review quantities,
          selections and the latest availability on your registration.
        </Text>
      </Section>
    )}

    <Text style={text}>
      Extras are subject to availability. Read the full details on the{' '}
      <Link href={extrasUrl} style={link}>PE Plett optional-extras page</Link>, then use your
      registration link below to add or change a booking.
    </Text>
    <Button style={button} href={registrationUrl}>Book extras on Entry Ninja</Button>

    <Text style={footer}>
      You are receiving this service update because you entered {eventName}. Your booked items are
      based on the latest entry information synced from Entry Ninja.
    </Text>
  </EmailShell>
)

export const template = {
  component: PePlettExtrasEmail,
  subject: (data: Record<string, any>) => `Your booked extras for ${data['eventName'] ?? 'PE Plett'}`,
  displayName: 'PE Plett booked extras',
  previewData: {
    firstName: 'Shaun',
    eventName: 'M&G Investments PE PLETT 2027',
    registrationUrl: 'https://entries.redcherryevents.co.za/registrations',
    bookedExtras: [],
    availableExtras: [],
  },
} satisfies TemplateEntry

export default PePlettExtrasEmail