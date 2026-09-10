import * as React from 'react'

import { Button, Heading, Img, Link, Section, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { EmailShell, brand, button, h1, link, text } from './theme'

export interface EventUpdateProps {
  firstName?: string | null
  eventName: string
  /** Plain text body — blank lines become paragraphs. */
  body: string
  heading?: string | null
  subject?: string
  ctaLabel?: string | null
  ctaUrl?: string | null
  eventUrl?: string | null
  eventCoverUrl?: string | null
  eventLogoUrl?: string | null
  /** Overrides the event cover at the top of the email. */
  bannerUrl?: string | null
  /** Extra pictures (route profiles etc) shown under the body, one per row. */
  images?: (string | { url: string; caption?: string | null })[] | null
  eventDate?: string | null
  venue?: string | null
  siteName?: string
  siteUrl?: string
}

const bannerWrap = { margin: '0 0 20px', textAlign: 'center' as const, lineHeight: 0 }
const bannerImg = {
  display: 'block',
  width: '100%',
  maxWidth: '100%',
  height: 'auto',
  borderRadius: '14px',
  border: `1px solid ${brand.border}`,
}

const meta = {
  fontSize: '13px',
  color: brand.muted,
  lineHeight: '1.6',
  margin: '0 0 18px',
}

/** Splits a plain-text body into paragraphs; never renders raw HTML. */
export function bodyParagraphs(body: string): string[] {
  return String(body ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export const EventUpdateEmail = ({
  firstName,
  eventName,
  body,
  heading,
  ctaLabel,
  ctaUrl,
  eventUrl,
  eventCoverUrl,
  eventLogoUrl,
  bannerUrl,
  images,
  eventDate,
  venue,
  siteName = 'Red Cherry Events',
  siteUrl = 'https://riderapp.redcherryevents.co.za',
}: EventUpdateProps) => {
  const paragraphs = bodyParagraphs(body)
  const banner = bannerUrl || eventCoverUrl || eventLogoUrl
  const gallery = (images ?? [])
    .map((i) => (typeof i === 'string' ? { url: i, caption: null } : i))
    .filter((i) => /^https:\/\//i.test(String(i?.url ?? '')))
  const cta = ctaUrl || eventUrl
  const ctaText = ctaLabel || 'Open your event page'

  return (
    <EmailShell preview={heading || `An update about ${eventName}`} siteName={siteName}>
      {banner ? (
        <Section style={bannerWrap}>
          <Img src={banner} alt={eventName} width="600" style={bannerImg} />
        </Section>
      ) : null}

      <Heading style={h1}>{heading || eventName}</Heading>

      <Text style={meta}>
        <strong>{eventName}</strong>
        {[eventDate, venue].filter(Boolean).length ? ` · ${[eventDate, venue].filter(Boolean).join(' · ')}` : ''}
      </Text>

      {firstName ? <Text style={text}>Hi {firstName},</Text> : null}

      {paragraphs.map((p, i) => (
        <Text key={i} style={text}>
          {p.split('\n').map((lineText, li) => (
            <React.Fragment key={li}>
              {li > 0 ? <br /> : null}
              {lineText}
            </React.Fragment>
          ))}
        </Text>
      ))}

      {cta ? (
        <Button style={button} href={cta}>
          {ctaText}
        </Button>
      ) : null}

      <Text style={{ ...text, margin: '20px 0 0' }}>
        Everything for this event — schedule, routes, village map and packing list — lives in the{' '}
        <Link href={siteUrl} style={link}>
          <strong>Red Cherry Rider Hub</strong>
        </Link>
        .
      </Text>
    </EmailShell>
  )
}

export const template = {
  component: EventUpdateEmail,
  subject: (data: Record<string, any>) =>
    String(data?.subject ?? `An update about ${data?.eventName ?? 'your event'}`),
  displayName: 'Event workflow update',
  previewData: {
    firstName: 'Shaun',
    eventName: 'Otto1890 Weekend Warrior Lourensford 2026',
    heading: 'Your route for race weekend',
    subject: 'Your route for race weekend',
    body: 'Here is everything you need to know about the route.\n\nThe 65 km loop climbs out of the estate before the singletrack section, with two water points along the way.',
    ctaLabel: 'View the routes',
    eventUrl: 'https://riderapp.redcherryevents.co.za',
    eventDate: 'Sat 5 September 2026',
    venue: 'Lourensford Wine Estate, Somerset West',
  },
} satisfies TemplateEntry
