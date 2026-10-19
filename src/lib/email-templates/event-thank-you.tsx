import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { RCE_LOGO_URL, bar, brand, button, h1, inner, main, container, text } from './theme'

interface Line { label: string; position: number | null; total: number; time: string | null; genderPlace: string | null; overall: boolean }
interface Person { name: string; bib: string | null; lines: Line[] }
interface Props {
  firstName?: string | null
  eventName?: string
  coverUrl?: string | null
  youtubeUrl?: string
  resultsUrl?: string
  people?: Person[]
}

const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const Email = ({ firstName, eventName = 'Otto1890 Weekend Warrior Lourensford', coverUrl, youtubeUrl, resultsUrl, people = [] }: Props) => {
  const withResults = people.filter((p) => p.lines.length)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Thank you for an incredible weekend — your results, highlights and photos</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={bar} />
          {coverUrl ? <Img src={coverUrl} alt={eventName} width="520" style={{ width: '100%', display: 'block' }} /> : null}
          <Section style={inner}>
            <Img src={RCE_LOGO_URL} alt="Red Cherry Events" height="40" style={{ marginBottom: 16 }} />
            <Heading style={h1}>Thank you for an incredible weekend{firstName ? `, ${firstName}` : ''}!</Heading>
            <Text style={text}>
              What a weekend at Lourensford. Saturday's rain cleared just in time, Sunday turned on the sunshine, and
              you rode some of the best trails the Helderberg has to offer. Thank you for being part of the {eventName} —
              every rider, family member, supporter and crew member made it the event it was.
            </Text>

            <Heading as="h2" style={h2}>Your results</Heading>
            {withResults.length ? (
              withResults.map((p) => (
                <Section key={p.name} style={card}>
                  <Text style={personName}>{p.name}{p.bib ? ` · #${p.bib}` : ''}</Text>
                  {p.lines.map((l) => (
                    <Section key={l.label} style={l.overall ? lineOverall : line}>
                      <Text style={lineLabel}>{l.label}</Text>
                      <Text style={lineValue}>
                        {l.position ? <strong>{ord(l.position)}</strong> : <strong>Finished</strong>}
                        {l.position && l.total ? ` of ${l.total}` : ''}
                        {l.time ? ` · ${l.time}` : ''}
                        {l.genderPlace && !l.overall ? ` · ${ord(Number(l.genderPlace))} by gender` : ''}
                      </Text>
                    </Section>
                  ))}
                </Section>
              ))
            ) : (
              <Text style={text}>
                We couldn't match a time to your entry automatically — you'll find the full results lists in the Rider Hub.
              </Text>
            )}
            {resultsUrl ? (
              <Section style={{ textAlign: 'center', margin: '8px 0 28px' }}>
                <Button href={resultsUrl} style={secondaryButton}>See the full results</Button>
              </Section>
            ) : null}

            <Heading as="h2" style={h2}>Relive the weekend</Heading>
            <Text style={text}>
              Our highlights video is up on the Weekend Warrior YouTube channel. Grab a coffee and see if you can spot yourself!
            </Text>
            {youtubeUrl ? (
              <Section style={{ textAlign: 'center', margin: '0 0 28px' }}>
                <Button href={youtubeUrl} style={youtubeButton}>▶ Watch the highlights on YouTube</Button>
              </Section>
            ) : null}

            <Heading as="h2" style={h2}>Photos are on the way</Heading>
            <Text style={text}>
              Our photographers are busy sorting through thousands of shots from both days. The event photos will be out
              soon — we'll let you know the moment they're ready.
            </Text>

            <Text style={text}>
              Thank you to Otto1890, Lourensford Wine Estate and every one of our partners who made this weekend possible.
              Next up, the Otto1890 Weekend Warrior heads to Oak Valley Wine Estate in April 2027 — we'd love to see you there.
            </Text>
            <Text style={text}>See you on the trails,<br />Shaun and the Red Cherry Events team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Thank you for an incredible Weekend Warrior — your results inside',
  displayName: 'Post-event thank you with results',
  previewData: {
    firstName: 'Natalie',
    youtubeUrl: 'https://www.youtube.com/watch?v=_sU-SqKrfos',
    resultsUrl: 'https://riderapp.redcherryevents.co.za',
    people: [{ name: 'Natalie Stacey', bib: '753', lines: [
      { label: 'Day 1 Gold', position: 232, total: 235, time: '4:41:20.96', genderPlace: '40', overall: false },
    ] }],
  },
} satisfies TemplateEntry

const h2 = { fontSize: '18px', fontWeight: 700 as const, color: brand.ink, margin: '8px 0 12px' }
const card = { border: `1px solid ${brand.border}`, borderRadius: '12px', padding: '14px 16px', margin: '0 0 14px' }
const personName = { fontSize: '16px', fontWeight: 700 as const, color: brand.ink, margin: '0 0 8px' }
const line = { borderTop: `1px solid ${brand.border}`, padding: '8px 0 2px' }
const lineOverall = { ...line, backgroundColor: '#FFF6EE', padding: '8px 10px 2px', borderRadius: '8px', borderTop: 'none', marginTop: '6px' }
const lineLabel = { fontSize: '12px', color: brand.muted, margin: '0', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const lineValue = { fontSize: '15px', color: brand.ink, margin: '2px 0 6px' }
const secondaryButton = { ...button, backgroundColor: brand.blue }
const youtubeButton = { ...button, backgroundColor: '#FF0000' }
