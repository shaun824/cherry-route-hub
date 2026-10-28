import * as React from 'react'

import { Link, Section, Text } from '@react-email/components'

import {
  ICE,
  ICE_ASSISTANT_URL,
  ICE_HERO_URL,
  ICE_TICKETS_URL,
  IceIntroBlock,
  IceSectionHeading,
  IceShell,
  IceStatRow,
  iceBlackButton,
  iceBody,
  iceHeading,
} from './ice-brand'
import type { TemplateEntry } from './registry'

interface Props {
  firstName?: string | null
}

const Email = ({ firstName }: Props) => (
  <IceShell
    preview="Thanks for signing up for Inner City Enduro 2026 updates. Here is everything you need to know."
    heroUrl={ICE_HERO_URL}
  >
    <IceIntroBlock label="Signed up" line1={`Thanks${firstName ? `, ${firstName}` : ''}.`} line2="You're in.">
      <Text style={{ ...iceBody, color: '#d8d8de', margin: '0' }}>
        You are on the list for Inner City Enduro 2026 updates. We will send you the race-week email with the full schedule, parking and everything you need for the weekend.
      </Text>
    </IceIntroBlock>

    <IceSectionHeading label="ICE 2026 at a glance" title="Brace yourself" />
    <IceStatRow
      stats={[
        { value: '28–29 Nov', note: 'Saturday practice, Sunday race day' },
        { value: 'Baakens Valley', note: 'In the heart of Gqeberha' },
        { value: 'R80 000', note: 'Prize purse up for grabs' },
      ]}
    />

    <IceSectionHeading title="What happens next" />
    <Section style={{ padding: '12px 28px 0' }}>
      <Text style={iceBody}>
        <strong style={{ color: ICE.black }}>Race-week email.</strong> The week before the event we will send you the full programme: practice day, race day, gate times, parking and the after party.
      </Text>
      <Text style={iceBody}>
        <strong style={{ color: ICE.black }}>Tickets.</strong> Weekend pass R175, Saturday or Sunday R110, kids under 14 R70 per day. Tickets are also on sale at the gate.
      </Text>
      <Section style={{ padding: '4px 0 0' }}>
        <Link href={ICE_TICKETS_URL} target="_blank" style={iceBlackButton}>
          Get tickets on Quicket
        </Link>
      </Section>
    </Section>

    <Section style={{ padding: '22px 28px 30px' }}>
      <Section style={{ borderLeft: `4px solid ${ICE.red}`, backgroundColor: ICE.offWhite, padding: '16px 18px' }}>
        <Text style={{ ...iceHeading, fontSize: '16px', margin: '0 0 8px' }}>Got a question?</Text>
        <Text style={{ ...iceBody, fontSize: '13px' }}>
          Ask the Rider Hub assistant about the event, the course or the venue, any time of day.
        </Text>
        <Link href={ICE_ASSISTANT_URL} target="_blank" style={{ color: ICE.red, fontWeight: 700, fontSize: '13px', textDecoration: 'underline' }}>
          Ask the Rider Hub
        </Link>
      </Section>
    </Section>
  </IceShell>
)

export const template = {
  component: Email,
  subject: 'Thanks for signing up: Inner City Enduro 2026',
  displayName: 'ICE 2026 sign-up confirmation',
  previewData: { firstName: 'Shaun' },
} satisfies TemplateEntry
