import * as React from 'react'
import { Button, Column, Heading, Link, Row, Section, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { KcaMatchBand, SlscFooter, SlscHeader, sl } from './sabrina-love-brand'
import day1Photo from '@/assets/slsc-day1-beach-walk.jpg.asset.json'
import day2Photo from '@/assets/slsc-day2-vitality-run.jpg.asset.json'
import day3Photo from '@/assets/slsc-day3-mtb.jpg.asset.json'
import day4Photo from '@/assets/slsc-day4-trail-run.jpg.asset.json'

const absolute = (url: string) => new URL(url, 'https://riderhub.redcherryevents.co.za').href

export interface SlscPreEventProps {
  firstName?: string | null
  /** 1 = Beach Walk & Surf Ski, 2 = Vitality Run, 3 = MTB & E-Bike, 4 = Trail Run & Kids of Steel */
  day?: 1 | 2 | 3 | 4
}

interface DayContent {
  dayLabel: string
  title: string
  dateLabel: string
  venue: string
  mapUrl: string
  photoUrl: string
  photoAlt: string
  intro: string
  schedule: { time: string; label: string; detail?: string }[]
  entries: { name: string; price: string }[]
  entryUrl: string
  extras: string[]
}

const DAYS: Record<number, DayContent> = {
  1: {
    dayLabel: 'DAY 1 · SUNDAY 27 DECEMBER 2026',
    title: 'Beach Walk & Surf Ski Challenge',
    dateLabel: 'Sunday 27 December 2026',
    venue: 'Central Beach, Plettenberg Bay',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Central+Beach+Plettenberg+Bay',
    photoUrl: absolute(day1Photo.url),
    photoAlt: 'Beach Walk and Surf Ski at Central Beach, Plettenberg Bay',
    intro: 'Kick off the Year of Joy on the beach. Paddlers take on a 12km surf ski from Central Beach to Robberg and back, while families walk 4km along the sand. Bring your wishing shells for the Sabrina Love wishing well on the route.',
    schedule: [
      { time: '08:00', label: '12km Surf Ski Single & Double start', detail: 'Central Beach to Robberg and back' },
      { time: '08:30', label: '4km Beach Walk starts', detail: 'Family friendly, bring your wishing shells' },
    ],
    entries: [
      { name: '12km Surf Ski Single', price: 'R450' },
      { name: '12km Surf Ski Double (per paddler)', price: 'R300' },
      { name: '4km Beach Walk Adult (18+)', price: 'R330' },
      { name: '4km Beach Walk Child (18 and under)', price: 'R200' },
    ],
    entryUrl: 'https://www.entryninja.com/events/83457-walk-surf-ski',
    extras: ['No cut-off times, go at your own pace', 'Support vehicles out on the route', 'Wear pink: the whole town goes pink for the Year of Joy'],
  },
  2: {
    dayLabel: 'DAY 2 · MONDAY 28 DECEMBER 2026',
    title: 'Discovery Vitality Run Series',
    dateLabel: 'Monday 28 December 2026',
    venue: 'Longstone Park, Plettenberg Bay',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Longstone+Park+Plettenberg+Bay',
    photoUrl: absolute(day2Photo.url),
    photoAlt: 'Discovery Vitality Run Series at Longstone Park, Plettenberg Bay',
    intro: 'A 5km or 10km road run through Plettenberg Bay, professionally timed with a water point on the route. More than 1,200 runners took part in 2025. Come add to the joy.',
    schedule: [
      { time: '07:00', label: '10km Road Run starts', detail: 'Professionally timed · 1 water point' },
      { time: '07:30', label: '5km Road Run starts', detail: 'Professionally timed · 1 water point' },
    ],
    entries: [
      { name: '10km Road Run', price: 'R450' },
      { name: '5km Road Run', price: 'R450' },
    ],
    entryUrl: 'https://www.entryninja.com/events/83458-vitality-run-series',
    extras: ['No cut-off times, go at your own pace', 'Support vehicles out on the route', 'Wear pink: the whole town goes pink for the Year of Joy'],
  },
  3: {
    dayLabel: 'DAY 3 · TUESDAY 29 DECEMBER 2026',
    title: 'MTB & E-Bike Challenge',
    dateLabel: 'Tuesday 29 December 2026',
    venue: 'Kurland Estate, The Crags',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kurland+Estate+The+Crags',
    photoUrl: absolute(day3Photo.url),
    photoAlt: 'MTB and E-Bike Challenge at Kurland Estate, The Crags',
    intro: 'Ride the trails of Kurland Estate and the MTO forestry. The 40km has about 702m of climbing with technical sections, the 25km suits intermediate riders, and the 10km is perfect for beginners and families. Dedicated e-bike starts at 07:00.',
    schedule: [
      { time: '07:00', label: '40km & 25km E-Bike start' },
      { time: '07:15', label: '40km MTB starts', detail: '±702m climbing · technical sections' },
      { time: '07:30', label: '25km MTB starts', detail: 'For intermediate riders' },
      { time: '07:45', label: '10km MTB starts', detail: 'Beginner & family friendly' },
    ],
    entries: [
      { name: '40km E-Bike', price: 'R550' },
      { name: '25km E-Bike', price: 'R550' },
      { name: '40km MTB', price: 'R550' },
      { name: '25km MTB', price: 'R550' },
      { name: '10km MTB', price: 'R450' },
    ],
    entryUrl: 'https://www.entryninja.com/events/83460-mtb-challenge',
    extras: ['No cut-off times, go at your own pace', 'Support vehicles out on every route', 'Water points on the route', 'Wear pink: the whole town goes pink for the Year of Joy'],
  },
  4: {
    dayLabel: 'DAY 4 · WEDNESDAY 30 DECEMBER 2026',
    title: 'Trail Run & Kids of Steel',
    dateLabel: 'Wednesday 30 December 2026',
    venue: 'Kurland Estate, The Crags',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kurland+Estate+The+Crags',
    photoUrl: absolute(day4Photo.url),
    photoAlt: 'Trail Run and Kids of Steel at Kurland Estate, The Crags',
    intro: 'The last day of the Challenge. Trail runs of 6km, 12km and 21km through Kurland Estate, followed by the much-loved Kids of Steel run/swim/run for young athletes.',
    schedule: [
      { time: '06:30', label: '21km Trail Run starts', detail: 'For experienced trail runners' },
      { time: '07:00', label: '12km Trail Run starts' },
      { time: '07:30', label: '6km Trail Run starts', detail: 'Good for newer trail runners' },
      { time: '09:30', label: 'Kids of Steel Run/Swim/Run', detail: 'Ages 8–10: ±1.5km · Ages 11–14: ±3km (2 laps)' },
    ],
    entries: [
      { name: '21km Trail Run', price: 'R560' },
      { name: '12km Trail Run', price: 'R450' },
      { name: '6km Trail Run', price: 'R450' },
      { name: 'Kids of Steel (ages 8–14)', price: 'R250' },
    ],
    entryUrl: 'https://www.entryninja.com/events/83461-trail-run',
    extras: ['No cut-off times, go at your own pace', 'Support vehicles out on every route', 'Water points on the route', 'Wear pink: the whole town goes pink for the Year of Joy'],
  },
}

const card = {
  backgroundColor: sl.softPink,
  borderRadius: '12px',
  margin: '0 0 14px',
  padding: '18px 20px',
}

export function SabrinaLovePreEvent({ firstName, day = 1 }: SlscPreEventProps) {
  const d = DAYS[day] ?? DAYS[1]
  return (
    <>
      <SlscHeader dayLabel={d.dayLabel} />
      <Section style={sl.inner}>
        <Text style={sl.label}>YOUR PRE-EVENT GUIDE</Text>
        <Heading style={sl.heading}>{d.title}</Heading>
        <Text style={sl.text}>
          {firstName ? `Hi ${firstName}, ` : ''}here is everything you need for {d.title} on {d.dateLabel}. {d.intro}
        </Text>

        <Section style={card}>
          <Text style={{ ...sl.label, margin: '0 0 8px' }}>YOUR DAY AT A GLANCE</Text>
          <Text style={{ ...sl.text, margin: '0 0 4px' }}><strong>Date:</strong> {d.dateLabel}</Text>
          <Text style={{ ...sl.text, margin: '0 0 4px' }}><strong>Venue:</strong> {d.venue}</Text>
          <Text style={{ ...sl.text, margin: '0 0 4px' }}>
            <strong>Getting there:</strong>{' '}
            <Link href={d.mapUrl} style={{ color: sl.pink }}>Open in Google Maps</Link>
          </Text>
          <Text style={{ ...sl.text, margin: '0' }}><strong>Parking:</strong> at the venue. Use the <Link href={d.mapUrl} style={{ color: sl.pink }}>Google Maps link</Link> above for directions and parking at {d.venue}.</Text>
        </Section>

        <Section style={card}>
          <Text style={{ ...sl.label, margin: '0 0 8px' }}>SCHEDULE</Text>
          {d.schedule.map((s) => (
            <Row key={s.time + s.label} style={{ marginBottom: '6px' }}>
              <Column style={{ width: '64px', verticalAlign: 'top' }}>
                <Text style={{ ...sl.text, margin: '0', fontWeight: 700, color: sl.pink }}>{s.time}</Text>
              </Column>
              <Column style={{ verticalAlign: 'top' }}>
                <Text style={{ ...sl.text, margin: '0' }}><strong>{s.label}</strong>{s.detail ? ` · ${s.detail}` : ''}</Text>
              </Column>
            </Row>
          ))}
        </Section>

        <Section style={card}>
          <Text style={{ ...sl.label, margin: '0 0 8px' }}>ENTRY OPTIONS</Text>
          {d.entries.map((e) => (
            <Row key={e.name} style={{ marginBottom: '4px' }}>
              <Column><Text style={{ ...sl.text, margin: '0' }}>{e.name}</Text></Column>
              <Column style={{ width: '70px', textAlign: 'right' }}><Text style={{ ...sl.text, margin: '0', fontWeight: 700 }}>{e.price}</Text></Column>
            </Row>
          ))}
          <Text style={{ ...sl.text, fontSize: '13px', color: sl.muted, margin: '10px 0 0' }}>Every entry includes a finisher medal and the 2026 Year of Joy T-shirt, presented by Discovery. Entry Ninja may add a booking fee at checkout.</Text>
        </Section>

        <Section style={{ margin: '8px 0 20px' }}>
          <Button href={d.entryUrl} style={{ ...sl.button, display: 'block', textAlign: 'center' }}>Enter {d.title} ♥</Button>
        </Section>

        <Section style={card}>
          <Text style={{ ...sl.label, margin: '0 0 8px' }}>GOOD TO KNOW</Text>
          {d.extras.map((x) => <Text key={x} style={{ ...sl.text, margin: '0 0 4px' }}>♥ {x}</Text>)}
          <Text style={{ ...sl.text, margin: '8px 0 0' }}>Doing more than one day? Lots of people do all four: paddle or walk on the 27th, run on the 28th, ride on the 29th and trail-run on the 30th.</Text>
        </Section>

        <KcaMatchBand entryUrl={d.entryUrl} />

        <Text style={{ ...sl.text, fontSize: '13px', color: sl.muted }}>
          100% of proceeds go to the Sabrina Love Foundation, caring for children with disabilities in Plettenberg Bay and the Bitou region. Together, we're inspiring inclusion. ♥
        </Text>
      </Section>
      <SlscFooter />
    </>
  )
}

export const template: TemplateEntry = {
  component: SabrinaLovePreEvent,
  subject: (data) => `Your guide to Day ${data?.day ?? 1} of the Sabrina Love Summer Challenge 2026 ♥`,
  displayName: 'Sabrina Love Summer Challenge: pre-event guide',
  previewData: { firstName: 'Shaun', day: 1 },
}
