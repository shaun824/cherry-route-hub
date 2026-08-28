import * as React from 'react'

import { Button, Heading, Img, Link, Section, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { EmailShell, brand, button, h1, link, text } from './theme'

/** One day of the rider's confirmed times. */
export interface ApologyScheduleDay {
  label: string
  date?: string | null
  items: { time: string; label: string; details?: string | null }[]
}

export interface ScheduleApologyProps {
  firstName?: string
  eventName: string
  /** e.g. "Trip 1 | 22 – 25 April 2027" — the trip this rider is entered for. */
  tripName?: string | null
  tripDates?: string | null
  venue?: string | null
  venueUrl?: string | null
  eventUrl: string
  /** Absolute URL of the event's cover/banner image, shown full width at the top. */
  eventCoverUrl?: string | null
  /** Absolute URL of the event's logo (fallback when there's no cover image). */
  eventLogoUrl?: string | null
  schedule?: ApologyScheduleDay[]
  siteName?: string
  siteUrl?: string
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

const tripLine = {
  fontSize: '18px',
  fontWeight: 700 as const,
  color: brand.ink,
  lineHeight: '1.35',
  margin: '0 0 6px',
}

const meta = { fontSize: '14px', color: brand.muted, lineHeight: '1.6', margin: '0' }

const scheduleDay = { borderTop: `2px solid ${brand.border}`, padding: '16px 0 10px' }
const scheduleDayFirst = { ...scheduleDay, borderTop: `3px solid ${brand.orange}` }

const scheduleDayTitle = {
  fontSize: '17px',
  fontWeight: 700 as const,
  color: brand.ink,
  lineHeight: '1.4',
  margin: '0 0 10px',
}

const scheduleItem = { fontSize: '15px', color: brand.ink, lineHeight: '1.55', margin: '0 0 8px' }
const muted = { color: brand.muted, fontWeight: 400 as const }

export const ScheduleApologyEmail = ({
  firstName,
  eventName,
  tripName,
  tripDates,
  venue,
  venueUrl,
  eventUrl,
  schedule = [],
  siteName = 'Red Cherry Events',
  siteUrl = 'https://riderapp.redcherryevents.co.za',
}: ScheduleApologyProps) => (
  <EmailShell
    preview={`Your confirmed times for ${tripName ? `${eventName} — ${tripName}` : eventName}`}
    siteName={siteName}
  >
    <Heading style={h1}>{firstName ? `${firstName}, here are your real times` : 'Here are your real times'}</Heading>

    <Text style={text}>
      Apologies — the email we sent you about <strong>{eventName}</strong> showed
      &ldquo;TBC&rdquo; next to your daily times when the itinerary was in fact already
      confirmed. That was our mistake, and here is the correct schedule for the trip you
      are entered for.
    </Text>

    <Section style={card}>
      <Text style={cardTitle}>Your trip</Text>
      <Text style={tripLine}>{tripName ? `${eventName} · ${tripName}` : eventName}</Text>
      <Text style={meta}>
        {[tripDates, venue].filter(Boolean).join(' · ')}
        {venue && venueUrl ? (
          <>
            {' — '}
            <Link href={venueUrl} style={link}>
              directions
            </Link>
          </>
        ) : null}
      </Text>

      {schedule.length ? (
        <>
          <Text style={{ ...cardTitle, margin: '16px 0 8px' }}>Your confirmed times</Text>
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
                  <strong>{it.time}</strong>
                  {' — '}
                  <span style={muted}>
                    {it.label}
                    {it.details ? ` (${it.details})` : ''}
                  </span>
                </Text>
              ))}
            </Section>
          ))}
        </>
      ) : null}
    </Section>

    <Button style={button} href={eventUrl}>
      Open your event page
    </Button>

    <Text style={{ ...text, margin: '18px 0 20px' }}>
      Your full day-by-day itinerary, routes, packing list and village details live in the{' '}
      <Link href={siteUrl} style={link}>
        <strong>Red Cherry Rider Hub</strong>
      </Link>
      , and we keep it in step with the event website. Thanks for your patience — see you in
      the park.
    </Text>
  </EmailShell>
)

export const template = {
  component: ScheduleApologyEmail,
  subject: (data: Record<string, any>) =>
    `Sorry about the TBC times — your confirmed ${data?.tripName ? String(data.tripName) : 'trip'} schedule`,
  displayName: 'Schedule correction & apology',
  previewData: {
    firstName: 'Shaun',
    eventName: 'Tour de Addo 2027 | Best of Darlington Dam',
    tripName: 'Trip 1',
    tripDates: '22 – 25 April 2027',
    venue: 'Darlington Dam, Addo Elephant National Park',
    eventUrl: 'https://riderapp.redcherryevents.co.za',
    schedule: [
      {
        label: 'Trip 1 · Registration Day',
        date: 'Thu 22 Apr',
        items: [
          { time: '14:00', label: 'Registration opens', details: 'At the Darlington Dam access gate.' },
          { time: '16:00', label: 'Sunset ride start', details: 'Short 18.56 km ride.' },
        ],
      },
    ],
  },
} satisfies TemplateEntry
