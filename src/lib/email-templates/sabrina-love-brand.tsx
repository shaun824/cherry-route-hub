import * as React from 'react'
import { Button, Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components'
import kcaLogo from '@/assets/kca-logo.png.asset.json'
import discoveryLogo from '@/assets/discovery-logo.jpg.asset.json'

const absolute = (url: string) => new URL(url, 'https://riderhub.redcherryevents.co.za').href

/** Sabrina Love Summer Challenge email design tokens — from the 2026 campaign design system. */
export const sl = {
  pink: '#E6007E',
  deepPink: '#B80065',
  softPink: '#FDE3F1',
  yellow: '#FFC83D',
  ink: '#2B2B2B',
  muted: '#6B6B6B',
  white: '#FFFFFF',
  line: '#F5C6E0',
  body: { margin: '0', padding: '0', backgroundColor: '#FFFFFF', fontFamily: 'Helvetica, Arial, sans-serif' },
  container: { maxWidth: '600px', margin: '0 auto', padding: '0 0 24px' },
  inner: { padding: '26px 24px 12px' },
  text: { fontSize: '15px', lineHeight: '1.65', color: '#2B2B2B', margin: '0 0 18px' },
  heading: { fontSize: '28px', lineHeight: '1.25', fontWeight: 800 as const, color: '#E6007E', margin: '0 0 18px' },
  label: { fontSize: '12px', lineHeight: '1.5', fontWeight: 700 as const, letterSpacing: '1.5px', color: '#E6007E', margin: '0 0 10px' },
  script: { fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' as const, fontWeight: 400 as const },
  button: { backgroundColor: '#E6007E', color: '#FFFFFF', fontSize: '15px', fontWeight: 700 as const, textDecoration: 'none', padding: '15px 24px', borderRadius: '999px' },
  buttonGhost: { backgroundColor: '#FFFFFF', color: '#E6007E', fontSize: '15px', fontWeight: 700 as const, textDecoration: 'none', padding: '14px 24px', borderRadius: '999px', border: '2px solid #E6007E' },
}

export const SLSC_SITE = 'https://sabrinalove.co.za/summer-challenge-2026/'
export const SLSC_GIVENGAIN = 'https://www.givengain.com/cc/sabrinalove'
export const SLSC_WHATSAPP = 'https://wa.me/27788038978'

export function SlscHeader({ dayLabel, photoUrl, photoAlt }: { dayLabel: string; photoUrl: string; photoAlt: string }) {
  return <>
    <Section style={{ backgroundColor: sl.pink, padding: '26px 24px 24px', textAlign: 'center' }}>
      <Text style={{ ...sl.script, color: sl.white, fontSize: '26px', lineHeight: '1.3', margin: '0 0 6px' }}>Sabrina Love Summer Challenge 2026</Text>
      <Text style={{ ...sl.label, color: sl.yellow, margin: '0' }}>27–30 DECEMBER · PLETTENBERG BAY</Text>
    </Section>
    <Img src={photoUrl} alt={photoAlt} width="600" style={{ width: '100%', maxWidth: '600px', height: 'auto', display: 'block' }} />
    <Section style={{ backgroundColor: sl.deepPink, padding: '12px 24px' }}>
      <Text style={{ ...sl.label, color: sl.white, margin: '0', textAlign: 'center' }}>{dayLabel}</Text>
    </Section>
  </>
}

export function KcaMatchBand({ entryUrl }: { entryUrl: string }) {
  return <Section style={{ backgroundColor: sl.pink, padding: '26px 24px', margin: '12px 0 24px', borderRadius: '12px' }}>
    <Text style={{ ...sl.label, color: sl.yellow }}>♥ MATCH-FUNDED BY KCA</Text>
    <Heading as="h2" style={{ color: sl.white, fontSize: '26px', lineHeight: '1.25', fontWeight: 800, margin: '0 0 12px' }}>
      Give once. Make <span style={{ color: sl.yellow }}>twice</span> the difference.
    </Heading>
    <Text style={{ ...sl.text, color: sl.white }}>
      Keep a Child Alive has proposed a match-funding commitment for the Summer Challenge. Once confirmed, your entry and any extra donation could make twice the difference for children with disabilities in the greater Plettenberg Bay community.
    </Text>
    <Text style={{ ...sl.text, color: sl.white, fontWeight: 700 }}>♥ Let's raise a million!</Text>
    <Row style={{ margin: '6px 0 18px' }}>
      <Column style={{ paddingRight: '6px' }}>
        <Button href={entryUrl} style={{ ...sl.buttonGhost, display: 'block', textAlign: 'center' }}>Enter &amp; add a donation</Button>
      </Column>
      <Column style={{ paddingLeft: '6px' }}>
        <Button href={SLSC_GIVENGAIN} style={{ ...sl.button, backgroundColor: sl.deepPink, display: 'block', textAlign: 'center' }}>Donate on GivenGain ♥</Button>
      </Column>
    </Row>
    <Row>
      <Column style={{ width: '120px', verticalAlign: 'middle' }}>
        <Section style={{ backgroundColor: sl.white, borderRadius: '10px', padding: '8px' }}>
          <Img src={absolute(kcaLogo.url)} alt="Keep a Child Alive" width="100" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </Section>
      </Column>
      <Column style={{ verticalAlign: 'middle', paddingLeft: '12px' }}>
        <Text style={{ ...sl.text, color: sl.white, fontSize: '13px', margin: '0' }}>Keep a Child Alive, our matching partner</Text>
      </Column>
    </Row>
  </Section>
}

export function SlscFooter() {
  return <Section style={{ backgroundColor: sl.white, borderTop: `3px solid ${sl.softPink}`, padding: '26px 24px 8px' }}>
    <Text style={{ ...sl.label, color: sl.ink, borderBottom: `1px solid ${sl.line}`, paddingBottom: '10px' }}><span style={{ color: sl.pink }}>♥ </span>WITH THANKS TO OUR SPONSORS</Text>
    <Section style={{ padding: '14px 0 6px', textAlign: 'center' }}>
      <Img src={absolute(discoveryLogo.url)} alt="Discovery" width="180" style={{ width: '180px', height: 'auto', margin: '0 auto', display: 'block' }} />
    </Section>
    <Text style={{ ...sl.text, fontSize: '13px', color: sl.muted, textAlign: 'center', margin: '14px 0 0' }}>
      Questions? Call or WhatsApp the Sabrina Love Foundation on{' '}
      <Link href={SLSC_WHATSAPP} style={{ color: sl.pink }}>+27 78 803 8978</Link> or email{' '}
      <Link href="mailto:claudine@sabrinalove.co.za" style={{ color: sl.pink }}>claudine@sabrinalove.co.za</Link>
    </Text>
    <Text style={{ ...sl.text, fontSize: '13px', color: sl.muted, textAlign: 'center', margin: '0 0 18px' }}>
      <Link href="https://www.instagram.com/sabrinalovefound/" style={{ color: sl.pink }}>Instagram</Link>
      {' · '}<Link href="https://web.facebook.com/SabrinaLoveFoundation" style={{ color: sl.pink }}>Facebook</Link>
      {' · '}<Link href="https://www.youtube.com/@sabrinalovefoundation" style={{ color: sl.pink }}>YouTube</Link>
      {' · '}<Link href={SLSC_SITE} style={{ color: sl.pink }}>sabrinalove.co.za</Link>
    </Text>
    <Section style={{ padding: '18px 16px 12px', borderTop: `1px solid ${sl.line}`, textAlign: 'center' }}>
      <Text style={{ ...sl.text, fontSize: '12px', color: sl.muted, margin: '0' }}>See you in Plett for the Year of Joy!<br />Shaun and the Red Cherry Events team</Text>
      <Link href="https://www.redcherryevents.co.za" style={{ color: sl.pink, fontSize: '12px' }}>redcherryevents.co.za</Link>
    </Section>
  </Section>
}
