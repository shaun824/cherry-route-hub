import * as React from 'react'

import { Column, Link, Row, Section, Text } from '@react-email/components'

import {
  ICE,
  ICE_ASSISTANT_URL,
  ICE_COURSE_URL,
  ICE_HERO_URL,
  ICE_TICKETS_URL,
  IceIntroBlock,
  IceSectionHeading,
  IceShell,
  IceStatRow,
  iceBlackButton,
  iceBody,
  iceHeading,
  iceRedButton,
} from './ice-brand'
import type { TemplateEntry } from './registry'

interface Props {
  firstName?: string | null
  unsubscribeUrl?: string | null
}

const steps = [
  { n: '1', title: 'Race the lap.', text: 'Every rider still in starts together.' },
  { n: '2', title: "Last one's out.", text: 'The last rider across the line is eliminated.' },
  { n: '3', title: 'Restart. Repeat.', text: 'Until one rider is left standing. Winner takes all.' },
]

const tickets = [
  { label: 'Weekend pass', price: 'R175' },
  { label: 'Saturday or Sunday (adult)', price: 'R110' },
  { label: 'Kids under 14, per day', price: 'R70' },
]

const Email = ({ firstName, unsubscribeUrl }: Props) => (
  <IceShell
    preview="Inner City Enduro is this weekend in the Baakens Valley. Race format, schedule, tickets and the course, all in one place."
    heroUrl={ICE_HERO_URL}
    unsubscribeUrl={unsubscribeUrl}
  >
    <IceIntroBlock label="Race week" line1={`${firstName || 'Rider'}, it's on.`} line2="This weekend.">
      <Text style={{ ...iceBody, color: '#d8d8de', margin: '0' }}>
        Inner City Enduro is this weekend, 28 and 29 November 2026, in the Baakens Valley, Gqeberha. R80 000 prize purse, and in Last Man Standing the winner takes all.
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

    <IceSectionHeading title="Last Man Standing" />
    <Section style={{ padding: '12px 28px 0' }}>
      <Text style={iceBody}>
        The country's best hard enduro pros battle it out on one brutal inner-city track. In the finals, every lap is a new race:
      </Text>
      {steps.map((s) => (
        <Row key={s.n} style={{ marginBottom: '10px' }}>
          <Column style={{ width: '34px', verticalAlign: 'top' }}>
            <Text style={{ fontFamily: ICE.headingFont, fontSize: '22px', fontWeight: 900, color: ICE.red, margin: '0' }}>{s.n}</Text>
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text style={{ ...iceBody, margin: '0' }}>
              <strong style={{ color: ICE.black }}>{s.title}</strong> {s.text}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>

    <IceSectionHeading title="The weekend" />
    <Section style={{ padding: '12px 28px 0' }}>
      <Row>
        <Column style={{ width: '50%', verticalAlign: 'top', paddingRight: '8px' }}>
          <Section style={{ border: `2px solid ${ICE.black}`, padding: '14px' }}>
            <Text style={{ ...iceHeading, fontSize: '15px', margin: '0 0 8px' }}>Sat 28 Nov · Practice day</Text>
            <Text style={{ ...iceBody, fontSize: '13px', margin: '0' }}>
              Walk the track, then watch the Support and Pro riders get their first laps on the 2026 course.
            </Text>
          </Section>
        </Column>
        <Column style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
          <Section style={{ border: `2px solid ${ICE.black}`, padding: '14px' }}>
            <Text style={{ ...iceHeading, fontSize: '15px', margin: '0 0 8px' }}>Sun 29 Nov · Race day</Text>
            <Text style={{ ...iceBody, fontSize: '13px', margin: '0' }}>
              Heats from 11:00, the Red Bull Hill Climb, the Last Man Standing finals, burnouts, prize giving and the after party.
            </Text>
          </Section>
        </Column>
      </Row>
    </Section>

    <Section style={{ padding: '22px 28px 0' }}>
      <Section style={{ backgroundColor: ICE.navy, padding: '20px 22px' }}>
        <Text style={{ ...iceBody, color: '#9d9ac7', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 6px' }}>
          The course
        </Text>
        <Text style={{ fontFamily: ICE.headingFont, fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', color: ICE.white, margin: '0 0 10px' }}>
          14 sections. One lap.
        </Text>
        <Text style={{ ...iceBody, color: '#d8d8ea', fontSize: '13px' }}>
          From MBDA Piping Hot to Triple L Free Fall, starting and finishing under the Red Bull arches. Oxygen Tyres is the official tyre partner of ICE.
        </Text>
        <Link href={ICE_COURSE_URL} target="_blank" style={iceRedButton}>
          Explore the course map
        </Link>
      </Section>
    </Section>

    <IceSectionHeading title="Getting there" />
    <Section style={{ padding: '12px 28px 0' }}>
      <Text style={iceBody}>[TO CONFIRM: parking, gate times and entrance]</Text>
    </Section>

    <IceSectionHeading title="Get trackside" />
    <Section style={{ padding: '12px 28px 0' }}>
      {tickets.map((t) => (
        <Row key={t.label} style={{ borderBottom: '1px solid #e6e6ea' }}>
          <Column style={{ padding: '10px 0' }}>
            <Text style={{ ...iceBody, margin: '0' }}>{t.label}</Text>
          </Column>
          <Column align="right" style={{ padding: '10px 0' }}>
            <Text style={{ fontFamily: ICE.headingFont, fontSize: '16px', fontWeight: 900, color: ICE.black, margin: '0' }}>{t.price}</Text>
          </Column>
        </Row>
      ))}
      <Section style={{ padding: '16px 0 0' }}>
        <Link href={ICE_TICKETS_URL} target="_blank" style={iceBlackButton}>
          Buy tickets on Quicket
        </Link>
        <Text style={{ ...iceBody, fontSize: '12px', color: ICE.grey, margin: '10px 0 0' }}>
          Tickets are also on sale at the gate.
        </Text>
      </Section>
    </Section>

    <Section style={{ padding: '22px 28px 30px' }}>
      <Section style={{ borderLeft: `4px solid ${ICE.red}`, backgroundColor: ICE.offWhite, padding: '16px 18px' }}>
        <Text style={{ ...iceHeading, fontSize: '16px', margin: '0 0 8px' }}>Need a quick answer?</Text>
        <Text style={{ ...iceBody, fontSize: '13px' }}>
          Ask the Rider Hub assistant about times, parking, the route and the venue, any time of day.
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
  subject: 'Race week: Inner City Enduro this weekend',
  displayName: 'ICE 2026 race week',
  previewData: { firstName: 'Shaun' },
} satisfies TemplateEntry
