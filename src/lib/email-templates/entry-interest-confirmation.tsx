import * as React from 'react'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { RCE_LOGO_URL, bar, brand, h1, inner, main, container, text } from './theme'

const dateRow = { fontSize: '16px', color: brand.ink, margin: '0 0 6px', lineHeight: '1.5' }
const card = { border: `1px solid ${brand.border}`, borderRadius: '10px', padding: '16px 18px', margin: '0 0 20px' }
const logoBanner = { background: 'linear-gradient(180deg,#ffffff,#f4f4f6)', border: `1px solid ${brand.border}`, borderRadius: '10px', padding: '20px' }

const Email = () => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're on the list — Weekend Warrior 2027 entries open 1 December</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={bar} />
        <Section style={inner}>
          <Heading style={h1}>You're on the list!</Heading>
          <Text style={text}>
            Thanks for signing up. Entries for Weekend Warrior 2027 open on <strong>1 December 2026</strong>, and
            we'll email you the moment they do. Pop these dates in your diary:
          </Text>
          <Section style={card}>
            <Text style={dateRow}><strong>Weekend Warrior Oak Valley</strong><br />2, 3 &amp; 4 April 2027</Text>
          </Section>
          <Section style={card}>
            <Text style={dateRow}><strong>Weekend Warrior Lourensford</strong><br />8, 9 &amp; 10 October 2027</Text>
          </Section>
          <Text style={text}>See you on the trails.<br />— The Red Cherry Events team</Text>
          <Section style={{ ...logoBanner, textAlign: 'center' as const }}>
            <Img src={RCE_LOGO_URL} alt="Red Cherry Events" width="132" style={{ display: 'inline-block', height: 'auto' }} />
          </Section>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: "You're on the list — Weekend Warrior 2027 dates",
  displayName: 'Weekend Warrior 2027 sign-up confirmation',
  previewData: {},
} satisfies TemplateEntry
