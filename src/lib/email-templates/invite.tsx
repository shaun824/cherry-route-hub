import * as React from 'react'

import { Button, Heading, Link, Section, Text } from '@react-email/components'

import { EmailShell, brand, button, footer, h1, link, text } from './theme'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  /** First name of the invitee, when we know it. */
  firstName?: string
  /** Event names already linked to this rider's entries. */
  events?: string[]
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
  fontSize: '15px',
  fontWeight: 600 as const,
  color: brand.ink,
  lineHeight: '1.5',
  margin: '0 0 6px',
}

const bullet = {
  fontSize: '14px',
  color: brand.muted,
  lineHeight: '1.6',
  margin: '0 0 6px',
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
  firstName,
  events = [],
}: InviteEmailProps) => (
  <EmailShell
    preview={
      events.length
        ? `Your Rider Hub account is ready — ${events[0]} and more inside`
        : `Your ${siteName} account is ready`
    }
    siteName={siteName}
  >
    <Heading style={h1}>
      {firstName ? `${firstName}, your Rider Hub is ready` : 'Your Rider Hub is ready'}
    </Heading>
    <Text style={text}>
      We&apos;ve set up your{' '}
      <Link href={siteUrl} style={link}>
        <strong>Red Cherry Events Rider Hub</strong>
      </Link>{' '}
      account. Set your password and everything for your events is waiting inside
      — no paperwork, no digging through emails.
    </Text>

    {events.length ? (
      <Section style={card}>
        <Text style={cardTitle}>Already on your account</Text>
        {events.map((name) => (
          <Text key={name} style={eventLine}>
            {name}
          </Text>
        ))}
      </Section>
    ) : null}

    <Section style={card}>
      <Text style={cardTitle}>What&apos;s inside</Text>
      <Text style={bullet}>Your entry, extras and kit sizes in one place</Text>
      <Text style={bullet}>Day-by-day schedules, routes and elevation profiles</Text>
      <Text style={bullet}>Village maps with your tent or chalet pinned</Text>
      <Text style={bullet}>Live event updates, weather and race-village info</Text>
      <Text style={bullet}>Cherry Miles loyalty rewards on every event you ride</Text>
    </Section>

    <Button style={button} href={confirmationUrl}>
      Set your password
    </Button>

    <Text style={footer}>
      This link is unique to you and expires shortly — if it&apos;s lapsed, use
      &quot;Forgot password&quot; on the sign-in screen. If you weren&apos;t
      expecting this, you can safely ignore this email.
    </Text>
  </EmailShell>
)

export default InviteEmail
