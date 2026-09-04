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
  /** Absolute URL of the event's own logo (fallback when there's no cover image). */
  eventLogoUrl?: string | null
  /** Absolute URL of the event's cover/banner image, shown full width at the top. */
  eventCoverUrl?: string | null

  /** Google Maps link for the venue so riders can navigate straight there. */
  venueUrl?: string | null
  /** The rider's own key times, pulled from the event schedule. */
  schedule?: EmailScheduleDay[]
  /** Everyone entered under this registration / email for this event. */
  party?: EmailPartyMember[]
  /** Live rider offers for THIS event, built at send time from the admin promo list. */
  offers?: EmailOffer[]
  siteName?: string
  siteUrl?: string
}

/** One day of the rider's key times. */
export interface EmailScheduleDay {
  label: string
  date?: string | null
  items: { time: string; label: string; details?: string | null }[]
}

/** One person entered under the same entry. */
export interface EmailPartyMember {
  name: string
  category?: string | null
  bibNumber?: string | null
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
  /** Absolute URL of the supplier logo, shown on a white tile like the app. */
  logoUrl?: string | null
  /** Hex brand accent used for the card background, matching the app card. */
  accent?: string | null
  /** CTA button label; falls back to "Get the code" / "View offer". */
  ctaLabel?: string | null
}



const eventLogoWrap = {
  margin: '0 0 20px',
  textAlign: 'center' as const,
  lineHeight: 0,
}

const eventLogoImg = {
  display: 'block',
  width: '100%',
  maxWidth: '100%',
  height: 'auto',
  borderRadius: '14px',
  border: `1px solid ${brand.border}`,
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

const scheduleDay = {
  borderTop: `2px solid ${brand.border}`,
  padding: '16px 0 10px',
}

const scheduleDayFirst = {
  ...scheduleDay,
  borderTop: `3px solid ${brand.orange}`,
}

const scheduleDayTitle = {
  fontSize: '17px',
  fontWeight: 700 as const,
  color: brand.ink,
  lineHeight: '1.4',
  margin: '0 0 10px',
}

const scheduleItem = {
  fontSize: '15px',
  color: brand.ink,
  lineHeight: '1.55',
  margin: '0 0 8px',
}

const offersHeading = {
  fontSize: '12px',
  fontWeight: 700 as const,
  letterSpacing: '1.4px',
  textTransform: 'uppercase' as const,
  color: brand.muted,
  margin: '0 0 10px',
}

/** Mirrors the app's rider-offer strip: brand-accent card, white logo tile. */
const offerCard = {
  borderRadius: '14px',
  padding: '16px 18px',
  margin: '0 0 12px',
}

const logoCell = { width: '64px', verticalAlign: 'top' as const }

const logoImg = {
  backgroundColor: '#ffffff',
  borderRadius: '10px',
  padding: '4px',
  objectFit: 'contain' as const,
}

const discountCell = { width: '92px', textAlign: 'right' as const, verticalAlign: 'top' as const }

const discountPill = {
  backgroundColor: '#ffffff',
  color: brand.ink,
  borderRadius: '8px',
  padding: '5px 9px',
  fontSize: '12px',
  fontWeight: 700 as const,
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
  whiteSpace: 'nowrap' as const,
}

const offerEyebrow = {
  fontSize: '10px',
  fontWeight: 700 as const,
  letterSpacing: '1.4px',
  textTransform: 'uppercase' as const,
  color: '#ffffff',
  opacity: 0.9,
  margin: '0 0 3px',
}

const offerCardTitle = {
  fontSize: '16px',
  fontWeight: 700 as const,
  color: '#ffffff',
  lineHeight: '1.35',
  margin: '0',
}

const offerCardBlurb = {
  fontSize: '13px',
  color: '#ffffff',
  opacity: 0.9,
  lineHeight: '1.5',
  margin: '6px 0 0',
}

const offerClaimLine = {
  fontSize: '13px',
  color: '#ffffff',
  lineHeight: '1.6',
  margin: '12px 0 0',
}

const offerNote = {
  fontSize: '12px',
  color: brand.muted,
  lineHeight: '1.6',
  margin: '0',
}

const offerCode = {
  fontFamily: 'Courier New, Courier, monospace',
  fontSize: '16px',
  fontWeight: 700 as const,
  color: '#ffffff',
  letterSpacing: '1px',
}

const offerCta = {
  display: 'inline-block',
  backgroundColor: '#ffffff',
  color: brand.ink,
  textDecoration: 'none',
  borderRadius: '8px',
  padding: '8px 14px',
  fontSize: '12px',
  fontWeight: 700 as const,
  letterSpacing: '0.6px',
  textTransform: 'uppercase' as const,
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
  party = [],


  venueUrl,
  eventLogoUrl,
  eventCoverUrl,
  schedule = [],

  siteName = 'Red Cherry Events',
  siteUrl = 'https://riderapp.redcherryevents.co.za',
}: EntryWelcomeProps) => (
  <EmailShell preview={`You're entered for ${eventName} — everything you need is in the Rider Hub`} siteName={siteName}>
    {eventCoverUrl || eventLogoUrl ? (
      <Section style={eventLogoWrap}>
        <Img
          src={(eventCoverUrl || eventLogoUrl) as string}
          alt={eventName}
          width="600"
          style={eventLogoImg}
        />
      </Section>
    ) : null}

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
        {[eventDate, category ? `Category: ${category}` : null, bibNumber ? `Race number: ${bibNumber}` : null]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {venue ? (
        <Text style={{ ...meta, margin: '6px 0 0' }}>
          📍{' '}
          {venueUrl ? (
            <Link href={venueUrl} style={link}>
              {venue}
            </Link>
          ) : (
            venue
          )}
          {venueUrl ? <span style={featureNote}> — tap for directions</span> : null}
        </Text>
      ) : null}
      {schedule.length ? (
        <>
          <Text style={{ ...cardTitle, margin: '16px 0 8px' }}>Your key times</Text>
          {schedule.map((d, di) => (
            <Section key={`${d.label}-${di}`} style={di === 0 ? scheduleDayFirst : scheduleDay}>
              <Text style={scheduleDayTitle}>
                <strong>
                  {d.label}
                  {d.date ? ` · ${d.date}` : ''}
                </strong>
              </Text>
              {d.items.map((it, ii) => (
                <Text key={`${it.label}-${ii}`} style={scheduleItem}>
                  <strong>{it.time}</strong>{' — '}
                  <span style={featureNote}>
                    {it.label}
                    {it.details ? ` (${it.details})` : ''}
                  </span>
                </Text>
              ))}
            </Section>
          ))}
        </>
      ) : null}
      {party.length > 1 ? (
        <>
          <Text style={{ ...cardTitle, margin: '16px 0 8px' }}>Everyone on this entry</Text>
          {party.map((p, i) => (
            <Text key={`${p.name}-${i}`} style={feature}>
              <strong>{p.name}</strong>
              {[p.category, p.bibNumber ? `Race number: ${p.bibNumber}` : null].filter(Boolean).length ? (
                <span style={featureNote}>
                  {' — '}
                  {[p.category, p.bibNumber ? `Race number: ${p.bibNumber}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null}
            </Text>
          ))}
        </>
      ) : null}
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
      <Section style={{ margin: '0 0 24px' }}>
        <Text style={offersHeading}>Your rider offers for {eventName}</Text>
        {offers.map((o, i) => (
          <Section
            key={`${o.brand}-${i}`}
            style={{ ...offerCard, backgroundColor: o.accent || brand.orange }}
          >
            <Row>
              {o.logoUrl ? (
                <Column style={logoCell}>
                  <Img src={o.logoUrl} alt={`${o.brand} logo`} width="48" height="48" style={logoImg} />
                </Column>
              ) : null}
              <Column>
                <Text style={offerEyebrow}>Rider offer · {o.brand}</Text>
                <Text style={offerCardTitle}>{o.title}</Text>
                {o.blurb ? <Text style={offerCardBlurb}>{o.blurb}</Text> : null}
              </Column>
              {o.discount ? (
                <Column style={discountCell}>
                  <span style={discountPill}>{o.discount}</span>
                </Column>
              ) : null}
            </Row>

            <Text style={offerClaimLine}>
              {o.code ? (
                <>
                  How to claim: use code <span style={offerCode}>{o.code}</span>
                </>
              ) : (
                <>How to claim: {o.redeem}</>
              )}
            </Text>

            {o.url ? (
              <Text style={{ margin: '10px 0 0' }}>
                <Link href={o.url} style={offerCta}>
                  {o.ctaLabel || (o.code ? 'Get the code' : 'View offer')}
                </Link>
              </Text>
            ) : null}
          </Section>
        ))}
        <Text style={{ ...offerNote, margin: '10px 0 0' }}>
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
        accent: '#2F5FA8',
      },
    ],

  },
} satisfies TemplateEntry

export default EntryWelcomeEmail
