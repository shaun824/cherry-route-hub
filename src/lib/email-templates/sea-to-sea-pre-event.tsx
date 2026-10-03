import * as React from 'react'
import { Button, Heading, Img, Link, Section, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { EmailShell, brand, button, footer, h1, link, text } from './theme'

export interface SeaToSeaPreEventProps {
  firstName?: string | null
  eventName?: string
  coverUrl?: string | null
  eventUrl?: string
  directionsUrl?: string
}

const card = {
  backgroundColor: '#FAFAFC',
  border: `1px solid ${brand.border}`,
  borderRadius: '12px',
  margin: '0 0 14px',
  padding: '17px 18px',
}

const title = {
  color: brand.ink,
  fontSize: '17px',
  fontWeight: 700 as const,
  lineHeight: '1.35',
  margin: '0 0 8px',
}

const copy = {
  color: brand.muted,
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 6px',
}

const eyebrow = {
  color: brand.orange,
  fontSize: '11px',
  fontWeight: 700 as const,
  letterSpacing: '1.2px',
  margin: '26px 0 10px',
  textTransform: 'uppercase' as const,
}

function InfoCard({ heading, lines }: { heading: string; lines: string[] }) {
  return (
    <Section style={card}>
      <Text style={title}>{heading}</Text>
      {lines.map((line) => <Text key={line} style={copy}>• {line}</Text>)}
    </Section>
  )
}

export const SeaToSeaPreEventEmail = ({
  firstName,
  eventName = 'JBFE Sea to Sea North 2026',
  coverUrl,
  eventUrl = 'https://riderapp.redcherryevents.co.za',
  directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=-31.9806207%2C29.1524639',
}: SeaToSeaPreEventProps) => (
  <EmailShell
    preview="Directions, fuel, packing, hotels and your full Sea to Sea schedule"
    siteName="JBFE Sea to Sea North"
  >
    {coverUrl ? (
      <Img
        src={coverUrl}
        alt={eventName}
        width="464"
        style={{ display: 'block', height: 'auto', margin: '0 0 24px', maxWidth: '100%', borderRadius: '12px' }}
      />
    ) : null}

    <Heading style={h1}>{firstName ? `${firstName}, Sea to Sea is nearly here` : 'Sea to Sea is nearly here'}</Heading>
    <Text style={text}>
      Here is your essential pre-event information for <strong>{eventName}</strong>. Please read it
      before travelling and keep this email handy for arrival day.
    </Text>

    <Text style={eyebrow}>Arrival and directions</Text>
    <InfoCard
      heading="Ocean View Hotel · Coffee Bay"
      lines={[
        'Arrive from 12:00 on Wednesday 21 October.',
        'Registration is at Ocean View Hotel from 14:00 to 19:00.',
        'The rider briefing starts at 20:00 after dinner.',
      ]}
    />
    <Button style={button} href={directionsUrl}>Directions to Ocean View Hotel</Button>

    <Text style={eyebrow}>Fuel — important</Text>
    <InfoCard
      heading="Bring 35 litres of fuel"
      lines={[
        'Arrive with your bike’s tank full.',
        'Bring 35 litres in sealed jerry cans, clearly marked with your name and race number.',
        'A 20 litre and 15 litre can works well; do not put fuel in your luggage bag.',
        'Hand fuel to the fuel truck with your luggage at 07:30 on Thursday and Saturday.',
        'Bring a funnel or pouring spout. Empty cans are returned at the finish.',
      ]}
    />

    <Text style={eyebrow}>Pack before you leave</Text>
    <InfoCard
      heading="Riding and safety essentials"
      lines={[
        'Helmet, goggles with a spare lens, riding boots, body armour and knee/elbow protection.',
        'Hydration pack, fully charged cellphone, tools, spares and snacks for each riding day.',
        'Rain jacket, warm jacket and fresh riding kit for three days.',
        'Bike spares: tyre repair kit, tools, levers, cable ties and anything specific to your bike.',
      ]}
    />
    <InfoCard
      heading="Your overnight bag"
      lines={[
        'Casual clothes, toiletries, towel and warm layers for four nights.',
        'Charging cables, power bank, headlamp and a 2-pin/USB adaptor.',
        'Chronic medication, sunscreen, mosquito repellent and personal first-aid items.',
        'Mark your luggage clearly with your name and race number.',
      ]}
    />

    <Text style={eyebrow}>Hotels</Text>
    <InfoCard
      heading="Four hotel nights"
      lines={[
        'Wednesday night: Ocean View Hotel, Coffee Bay.',
        'Thursday and Friday nights: The Haven Hotel at the Mbashee River mouth.',
        'Saturday night: Ocean View Hotel after the final ride and prize giving.',
        'Your luggage is transported between the hotels; place it at the luggage drop by 07:30 on moving days.',
      ]}
    />

    <Text style={eyebrow}>Your event schedule</Text>
    <InfoCard
      heading="Wednesday 21 October · Arrival"
      lines={['12:00 arrival', '14:00–19:00 registration', '19:00 dinner', '20:00 rider briefing', '20:30 night caps']}
    />
    <InfoCard
      heading="Thursday 22 October · Day 1"
      lines={['06:30 breakfast', '07:30 luggage and fuel drop', '08:00 depart: Ocean View to The Haven', '19:00 dinner', '20:30 rider briefing']}
    />
    <InfoCard
      heading="Friday 23 October · Day 2"
      lines={['06:30 breakfast', '08:00 depart: The Haven loop', '15:00 back at The Haven', '19:00 dinner', '20:30 rider briefing']}
    />
    <InfoCard
      heading="Saturday 24 October · Day 3"
      lines={['06:30 breakfast', '07:30 luggage and fuel drop', '08:00 depart: The Haven to Ocean View', '15:00 finish at Ocean View', '19:00 dinner', '20:30 prize giving and medals']}
    />
    <InfoCard heading="Sunday 25 October · Departure" lines={['06:30 breakfast', '08:30 depart for home']} />

    <Text style={eyebrow}>Routes</Text>
    <Section style={{ ...card, borderLeft: `4px solid ${brand.blue}` }}>
      <Text style={title}>Routes will be loaded at registration</Text>
      <Text style={{ ...copy, margin: '0' }}>
        The final route for your class will be loaded onto your GPS at registration. Please bring
        your GPS unit fully charged, together with its data cable. Route choices and any final
        changes will be covered at the rider briefings.
      </Text>
    </Section>

    <Text style={eyebrow}>Before travelling</Text>
    <InfoCard
      heading="Final checks"
      lines={[
        'Service your bike and test it before event week.',
        'Save the Ocean View directions for offline use before entering areas with limited signal.',
        'Check the Rider Hub for the latest schedule, packing list and event notices.',
        'Tell the Red Cherry team before departure if your travel plans change.',
      ]}
    />
    <Button style={button} href={eventUrl}>Open Sea to Sea in the Rider Hub</Button>

    <Text style={{ ...text, margin: '22px 0 0' }}>
      We cannot wait to welcome you to Coffee Bay. Ride safe and see you at Ocean View.
    </Text>
    <Text style={footer}>
      You are receiving this service update because you entered {eventName}. Please use the latest
      Rider Hub information and rider briefings if anything changes.
    </Text>
  </EmailShell>
)

export const template = {
  component: SeaToSeaPreEventEmail,
  subject: 'Sea to Sea North — your pre-event guide',
  displayName: 'Sea to Sea pre-event guide',
  previewData: {
    firstName: 'Shaun',
    eventName: 'JBFE Sea to Sea North 2026',
    coverUrl: 'https://riderapp.redcherryevents.co.za/__l5e/assets-v1/c862c4d7-29e0-48bf-a2f0-9c025d386814/sea-to-sea-2026-cover.png',
    eventUrl: 'https://riderapp.redcherryevents.co.za/my-events/cb6a0064-aa7e-4e26-928d-6a67d0a9722d',
  },
} satisfies TemplateEntry

export default SeaToSeaPreEventEmail