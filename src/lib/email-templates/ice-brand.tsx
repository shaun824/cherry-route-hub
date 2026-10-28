import * as React from 'react'

import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'

/**
 * Inner City Enduro email brand: black, red and navy with condensed bold
 * uppercase headings, matching the ICE website and the approved mailer design.
 * Email-only module, shared by the ICE race-week and sign-up emails.
 */
export const ICE = {
  black: '#000000',
  red: '#ed3237',
  white: '#ffffff',
  navy: '#1e1954',
  offWhite: '#f4f4f6',
  grey: '#8a8a93',
  headingFont: "'Arial Narrow', 'Helvetica Neue Condensed', 'Roboto Condensed', Arial, sans-serif",
  bodyFont: "Arial, Helvetica, sans-serif",
}

export const ICE_LOGO_URL = 'https://innercityenduro.co.za/wp-content/uploads/2020/04/ICE-white.png'
export const ICE_HERO_URL = 'https://innercityenduro.co.za/wp-content/uploads/2026/06/wide-1.jpg'
export const ICE_SITE_URL = 'https://innercityenduro.co.za'
export const ICE_TICKETS_URL = 'https://www.quicket.co.za/events/385502-inner-city-enduro-2026#/'
export const ICE_COURSE_URL = 'https://innercityenduro.co.za/#course'
export const ICE_ASSISTANT_URL = 'https://riderhub.redcherryevents.co.za/ask/f046ce38-e687-4038-959d-271ba20825f0'

export const iceHeading = {
  fontFamily: ICE.headingFont,
  fontWeight: 900 as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  color: ICE.black,
  margin: '0',
}

export const iceLabel = {
  fontFamily: ICE.bodyFont,
  fontSize: '11px',
  fontWeight: 700 as const,
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: ICE.red,
  margin: '0 0 6px',
}

export const iceBody = {
  fontFamily: ICE.bodyFont,
  fontSize: '14px',
  lineHeight: '1.55',
  color: '#3a3a40',
  margin: '0 0 14px',
}

export const iceRedButton = {
  backgroundColor: ICE.red,
  color: ICE.white,
  fontFamily: ICE.headingFont,
  fontSize: '14px',
  fontWeight: 800 as const,
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const iceBlackButton = { ...iceRedButton, backgroundColor: ICE.black }

/** Shared ICE shell: black header with logo, optional hero photo, black footer. */
export const IceShell = ({
  preview,
  children,
  heroUrl,
  unsubscribeUrl,
}: {
  preview: string
  children: React.ReactNode
  heroUrl?: string | null
  unsubscribeUrl?: string | null
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: ICE.offWhite, margin: '0', padding: '0', fontFamily: ICE.bodyFont }}>
      <Container style={{ maxWidth: '560px', margin: '0 auto', backgroundColor: ICE.white }}>
        <Section style={{ backgroundColor: ICE.black, padding: '22px 28px', textAlign: 'center' as const }}>
          <Link href={ICE_SITE_URL} target="_blank">
            <Img src={ICE_LOGO_URL} alt="Inner City Enduro" width="150" style={{ display: 'inline-block', height: 'auto' }} />
          </Link>
        </Section>
        {heroUrl ? (
          <Section style={{ padding: '0' }}>
            <Img src={heroUrl} alt="Inner City Enduro, Baakens Valley" width="560" style={{ display: 'block', width: '100%', height: 'auto' }} />
          </Section>
        ) : null}
        {children}
        <Section style={{ backgroundColor: ICE.black, borderTop: `4px solid ${ICE.red}`, padding: '24px 28px' }}>
          <Text style={{ fontFamily: ICE.headingFont, fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: ICE.white, margin: '0 0 8px' }}>
            Inner City Enduro · 28–29 Nov 2026
          </Text>
          <Text style={{ fontFamily: ICE.bodyFont, fontSize: '12px', lineHeight: '1.6', color: '#b9b9c2', margin: '0 0 10px' }}>
            Red Cherry Events · 041 581 5335 ·{' '}
            <Link href="mailto:team@redcherryevents.co.za" style={{ color: ICE.red, textDecoration: 'underline' }}>
              team@redcherryevents.co.za
            </Link>
          </Text>
          <Text style={{ fontFamily: ICE.bodyFont, fontSize: '12px', margin: '0 0 10px' }}>
            <Link href="https://www.instagram.com/innercityenduro" style={{ color: ICE.white, fontWeight: 700, textDecoration: 'none' }}>Instagram</Link>
            <span style={{ color: ICE.grey }}>{'  ·  '}</span>
            <Link href="https://www.facebook.com/innercityenduro" style={{ color: ICE.white, fontWeight: 700, textDecoration: 'none' }}>Facebook</Link>
            <span style={{ color: ICE.grey }}>{'  ·  '}</span>
            <Link href={ICE_SITE_URL} style={{ color: ICE.white, fontWeight: 700, textDecoration: 'none' }}>innercityenduro.co.za</Link>
          </Text>
          <Text style={{ fontFamily: ICE.bodyFont, fontSize: '11px', lineHeight: '1.6', color: ICE.grey, margin: '0' }}>
            You are getting this email because you asked for ICE 2026 updates on innercityenduro.co.za.
            {unsubscribeUrl ? (
              <>
                {' '}
                <Link href={unsubscribeUrl} style={{ color: ICE.grey, textDecoration: 'underline' }}>
                  Unsubscribe from these updates
                </Link>
                .
              </>
            ) : null}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

/** Black intro block with a small red label and a big two-line heading. */
export const IceIntroBlock = ({
  label,
  line1,
  line2,
  children,
}: {
  label: string
  line1: string
  line2: string
  children: React.ReactNode
}) => (
  <Section style={{ backgroundColor: ICE.black, padding: '28px' }}>
    <Text style={{ ...iceLabel, margin: '0 0 10px' }}>{label}</Text>
    <Text style={{ fontFamily: ICE.headingFont, fontSize: '34px', lineHeight: '1.05', fontWeight: 900, textTransform: 'uppercase', color: ICE.white, margin: '0' }}>
      {line1}
      <br />
      <span style={{ color: ICE.red }}>{line2}</span>
    </Text>
    <Section style={{ margin: '16px 0 0' }}>{children}</Section>
  </Section>
)

/** Section heading: small red label above a big condensed uppercase title. */
export const IceSectionHeading = ({ label, title }: { label?: string; title: string }) => (
  <Section style={{ padding: '26px 28px 0' }}>
    {label ? <Text style={iceLabel}>{label}</Text> : null}
    <Text style={{ ...iceHeading, fontSize: '24px', lineHeight: '1.1' }}>{title}</Text>
    <Section style={{ borderBottom: `3px solid ${ICE.red}`, width: '100%', margin: '10px 0 0', fontSize: '0', lineHeight: '0' }}>&nbsp;</Section>
  </Section>
)

/** Three-up stat row like the "ICE 2026 at a glance" block. */
export const IceStatRow = ({ stats }: { stats: { value: string; note: string }[] }) => (
  <Section style={{ padding: '16px 28px 4px' }}>
    <Row>
      {stats.map((s) => (
        <Column key={s.value} style={{ verticalAlign: 'top', paddingRight: '12px' }}>
          <Text style={{ fontFamily: ICE.headingFont, fontSize: '19px', fontWeight: 900, textTransform: 'uppercase', color: ICE.black, margin: '0', lineHeight: '1.1' }}>
            {s.value}
          </Text>
          <Text style={{ fontFamily: ICE.bodyFont, fontSize: '11px', lineHeight: '1.4', color: ICE.grey, margin: '4px 0 0' }}>{s.note}</Text>
        </Column>
      ))}
    </Row>
  </Section>
)
