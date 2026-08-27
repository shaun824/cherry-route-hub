import * as React from 'react'

import { Button, Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { EmailShell, brand, button, footer, h1, link, text } from './theme'

export interface EntryWelcomeProps {
  firstName?: string
  eventName: string
  eventDate?: string | null
  venue?: string | null
  category?: string | null
  bibNumber?: string | null
  /** Deep link to this event's page in the app. */
  eventUrl: string
  /** Primary CTA target — invite/set-password link, or the event page. */
  actionUrl: string
  actionLabel?: string
  needsPassword?: boolean
  /** Live rider offers for THIS event, built at send time from the admin promo list. */
  offers?: EmailOffer[]
  siteName?: string
  siteUrl?: string
}

/** One rider offer as it appears in the email. */
export interface EmailOffer {
  brand: string
  title: string
  blurb?: string | null
  /** Discount code, when the offer uses one. */
  code?: string | null
  /** How to claim, when there is no code. */
  redeem?: string | null
  discount?: string | null
  url?: string | null
}


const card = {
  backgroundColor: '#FAFAFC',
  border: `1px solid ${brand.border}`,
  borderRadius: '14px',
  padding: '18px 20px',
  margin: '0 0 24px',
}

const cardTitle = {
  fontSize: '11px',
  fontWeight: 700 as const,
  letterSpacing: '1.4px',
  textTransform: 'uppercase' as const,
  color: brand.muted,
  margin: '0 0 10px',
}

const eventLine = {
  fontSize: '18px',
  fontWeight: 700 as const,
  color: brand.ink,
  lineHeight: '1.35',
  margin: '0 0 6px',
}

const meta = {
  fontSize: '14px',
  color: brand.muted,
  lineHeight: '1.6',
  margin: '0',
}

const feature = {
  fontSize: '14px',
  color: brand.ink,
  lineHeight: '1.6',
  margin: '0 0 10px',
}

const featureNote = { color: brand.muted, fontWeight: 400 as const }

const offerRow = {
  borderTop: `1px solid ${brand.border}`,
  padding: '12px 0 0',
  margin: '12px 0 0',
}

const offerBrand = {
  fontSize: '11px',
  fontWeight: 700 as const,
  letterSpacing: '1.2px',
  textTransform: 'uppercase' as const,
  color: brand.muted,
  margin: '0 0 2px',
}

const offerTitle = {
  fontSize: '15px',
  fontWeight: 700 as const,
  color: brand.ink,
  lineHeight: '1.4',
  margin: '0 0 4px',
}

const offerClaim = {
  fontSize: '13px',
  color: brand.ink,
  lineHeight: '1.6',
  margin: '0',
}

const offerNote = { ...offerClaim, color: brand.muted, margin: '0 0 4px' }

const offerCode = {
  fontFamily: 'Courier New, Courier, monospace',
  fontSize: '16px',
  fontWeight: 700 as const,
  color: brand.ink,
  letterSpacing: '1px',
}


const FEATURES: { icon: string; title: string; note: string }[] = [
  { icon: '🗺️', title: 'Routes & elevation', note: 'every distance mapped, with water points, cut-offs and hover-linked climb profiles.' },
  { icon: '🕒', title: 'Day-by-day schedule', note: 'registration, briefings and start times, kept in sync with the event website.' },
  { icon: '⛺', title: 'Village map', note: 'find your tent, chalet or room, plus parking, showers, bar and the finish chute.' },
  { icon: '🎽', title: 'Your entry', note: 'category, race number, kit sizes, merchandise and anything still outstanding.' },
  { icon: '💬', title: 'Ask Red Cherry', note: 'the event bot answers questions instantly — directions, packing, cut-offs, anything.' },
  { icon: '🌦️', title: 'Weather & live updates', note: 'race-village news, alerts and forecasts as the weekend gets closer.' },
  { icon: '🍒', title: 'Cherry Miles', note: 'loyalty points on every event you ride, redeemable against future entries.' },
]

export const EntryWelcomeEmail = ({
  firstName,
  eventName,
  eventDate,
  venue,
  category,
  bibNumber,
  eventUrl,
  actionUrl,
  actionLabel,
  needsPassword = false,
  offers = [],

  siteName = 'Red Cherry Events',
  siteUrl = 'https://riderapp.redcherryevents.co.za',
}: EntryWelcomeProps) => (
  <EmailShell preview={`You're entered for ${eventName} — everything you need is in the Rider Hub`} siteName={siteName}>
    <Heading style={h1}>
      {firstName ? `${firstName}, you're in!` : "You're in!"}
    </Heading>
    <Text style={text}>
      Your entry for <strong>{eventName}</strong> is confirmed. Everything you need for
      the weekend now lives in your{' '}
      <Link href={siteUrl} style={link}>
        <strong>Red Cherry Rider Hub</strong>
      </Link>{' '}
      — one app, no digging through emails.
    </Text>

    <Section style={card}>
      <Text style={cardTitle}>Your entry</Text>
      <Text style={eventLine}>{eventName}</Text>
      <Text style={meta}>
        {[
          eventDate,
          venue,
          category ? `Category: ${category}` : null,
          bibNumber ? `Race number: ${bibNumber}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </Section>

    <Button style={button} href={actionUrl}>
      {actionLabel ?? (needsPassword ? 'Set your password & open your event' : 'Open your event page')}
    </Button>

    <Text style={{ ...text, margin: '18px 0 20px' }}>
      {needsPassword
        ? 'That link sets your password and drops you straight onto your event page.'
        : 'That link takes you straight to your event page.'}
    </Text>

    <Section style={card}>
      <Text style={cardTitle}>What&apos;s waiting inside</Text>
      {FEATURES.map((f) => (
        <Text key={f.title} style={feature}>
          {f.icon} <strong>{f.title}</strong> — <span style={featureNote}>{f.note}</span>
        </Text>
      ))}
    </Section>

    <Text style={text}>
      Tip: add the app to your home screen once you&apos;re signed in — it works
      offline at the venue, including your route and the village map.{' '}
      <Link href={eventUrl} style={link}>
        Open {eventName}
      </Link>
    </Text>

    {offers.length > 0 ? (
      <Section style={card}>
        <Text style={cardTitle}>Your rider offers for {eventName}</Text>
        {offers.map((o, i) => (
          <Section key={`${o.brand}-${i}`} style={i === 0 ? undefined : offerRow}>
            <Text style={offerBrand}>
              {o.brand}
              {o.discount ? ` · ${o.discount}` : ''}
            </Text>
            <Text style={offerTitle}>{o.title}</Text>
            {o.blurb ? <Text style={offerNote}>{o.blurb}</Text> : null}
            {o.code ? (
              <Text style={offerClaim}>
                How to claim: use code <span style={offerCode}>{o.code}</span>
                {o.url ? (
                  <>
                    {' '}
                    at{' '}
                    <Link href={o.url} style={link}>
                      {o.brand}
                    </Link>
                  </>
                ) : null}
                .
              </Text>
            ) : (
              <Text style={offerClaim}>
                How to claim: {o.redeem}
                {o.url ? (
                  <>
                    {' '}
                    <Link href={o.url} style={link}>
                      More about {o.brand}
                    </Link>
                  </>
                ) : null}
              </Text>
            )}
          </Section>
        ))}
        <Text style={{ ...offerNote, margin: '12px 0 0' }}>
          Offers can change — the latest ones are always in the app under Promos.
        </Text>
      </Section>
    ) : null}

    <Text style={footer}>

      You&apos;re receiving this because you entered {eventName} with Red Cherry Events.
      See you on the start line.
    </Text>
  </EmailShell>
)

export const template = {
  component: EntryWelcomeEmail,
  subject: (data: Record<string, any>) => `You're in — ${data['eventName'] ?? 'your next Red Cherry event'}`,
  displayName: 'Entry welcome',
  previewData: {
    firstName: 'Sam',
    eventName: 'Tour de Addo 2027',
    eventDate: 'Wednesday, 19 August 2026',
    venue: 'Addo Elephant Park',
    category: 'Trip 1',
    bibNumber: 'A123',
    eventUrl: 'https://riderapp.redcherryevents.co.za/my-events/demo',
    actionUrl: 'https://riderapp.redcherryevents.co.za/reset-password',
    needsPassword: true,
    offers: [
      {
        brand: 'Cycle Lab',
        title: 'R150 to spend at Cycle Lab',
        blurb: 'R150 is loaded onto the cell number on your entry.',
        redeem:
          'No code — give the cell number on your entry at the Cycle Lab stand or in any Cycle Lab store.',
        discount: 'R150',
        url: 'https://www.cyclelab.com',
      },
    ],

  },
} satisfies TemplateEntry

export default EntryWelcomeEmail
