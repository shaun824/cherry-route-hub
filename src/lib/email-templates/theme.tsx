import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import rceLogo from '@/assets/rce-logo.png.asset.json'

/** Absolute URL for the Red Cherry logo — emails can't use relative paths. */
export const RCE_LOGO_URL = `https://riderapp.redcherryevents.co.za${rceLogo.url}`

export const brand = {
  orange: '#F58220',
  blue: '#1E88CC',
  green: '#7CB342',
  ink: '#1B1B1F',
  muted: '#5C5F66',
  border: '#EAEAEF',
}

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: '0',
  padding: '0',
}

export const container = {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '0 0 32px',
}

export const bar = {
  height: '6px',
  background: `linear-gradient(90deg, ${brand.green} 0%, ${brand.blue} 50%, ${brand.orange} 100%)`,
  borderRadius: '0 0 4px 4px',
}

export const inner = { padding: '28px 28px 8px' }

export const h1 = {
  fontSize: '24px',
  fontWeight: 700 as const,
  color: brand.ink,
  margin: '0 0 16px',
  lineHeight: '1.25',
}

export const text = {
  fontSize: '15px',
  color: brand.muted,
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const link = { color: brand.blue, textDecoration: 'underline' }

export const button = {
  backgroundColor: brand.orange,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '10px',
  padding: '13px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const codeStyle = {
  fontSize: '30px',
  fontWeight: 700 as const,
  letterSpacing: '6px',
  color: brand.ink,
  backgroundColor: '#FFF4EA',
  border: `1px solid ${brand.orange}`,
  borderRadius: '10px',
  padding: '16px 20px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}

export const footer = {
  fontSize: '12px',
  color: '#9A9DA5',
  lineHeight: '1.6',
  margin: '24px 0 0',
}

const brandName = {
  fontSize: '13px',
  fontWeight: 700 as const,
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: brand.orange,
  margin: '20px 0 0',
}

export const EmailShell = ({
  preview,
  siteName,
  children,
}: {
  preview: string
  siteName: string
  children: React.ReactNode
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={bar} />
        <Section style={inner}>
          <Text style={brandName}>{siteName}</Text>
          {children}
          <Hr style={{ borderColor: brand.border, margin: '28px 0 0' }} />
          <Section style={{ textAlign: 'center' as const, padding: '20px 0 0' }}>
            <Img
              src={RCE_LOGO_URL}
              alt="Red Cherry Events"
              width="132"
              style={{ display: 'inline-block', height: 'auto' }}
            />
          </Section>
          <Text style={{ ...footer, textAlign: 'center' as const, margin: '12px 0 0' }}>
            Red Cherry Events Rider Hub — ride info, schedules and event updates
            in one place.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)
