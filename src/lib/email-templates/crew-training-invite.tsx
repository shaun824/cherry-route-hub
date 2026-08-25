import * as React from 'react'

import { Button, Heading, Link, Section, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { EmailShell, brand, button, footer, h1, link, text } from './theme'

export interface CrewTrainingInviteProps {
  firstName?: string
  email: string
  tempPassword?: string | null
  loginUrl: string
  learnUrl: string
  siteName?: string
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

const cred = {
  fontSize: '15px',
  color: brand.ink,
  lineHeight: '1.7',
  margin: '0',
}

const step = {
  fontSize: '14px',
  color: brand.ink,
  lineHeight: '1.6',
  margin: '0 0 8px',
}

const Email = ({
  firstName,
  email,
  tempPassword,
  loginUrl,
  learnUrl,
  siteName = 'Red Cherry Events',
}: CrewTrainingInviteProps) => (
  <EmailShell preview="Your Red Cherry crew portal is ready — start your training" siteName={siteName}>
    <Heading style={h1}>Welcome to the crew{firstName ? `, ${firstName}` : ''}</Heading>
    <Text style={text}>
      Your crew portal on the {siteName} rider app is set up. It holds everything you need to get up to
      speed: how the business runs, how each event is built, and what your department does on the ground.
      Please work through the training and take the tests.
    </Text>

    <Section style={card}>
      <Text style={cardTitle}>Your sign-in</Text>
      <Text style={cred}>
        <strong>Email:</strong> {email}
        {tempPassword ? (
          <>
            <br />
            <strong>Temporary password:</strong> {tempPassword}
          </>
        ) : null}
      </Text>
      {tempPassword ? (
        <Text style={{ ...text, margin: '10px 0 0', fontSize: '13px' }}>
          You'll be asked to set your own password the first time you sign in.
        </Text>
      ) : null}
    </Section>

    <Section style={card}>
      <Text style={cardTitle}>What to do</Text>
      <Text style={step}>1. Sign in to the crew portal.</Text>
      <Text style={step}>2. Open Crew Learn and work through each course.</Text>
      <Text style={step}>3. Complete the test at the end of every module.</Text>
      <Text style={{ ...step, margin: '0' }}>4. Ask questions in the app — the assistant knows the events.</Text>
    </Section>

    <Section style={{ margin: '0 0 26px' }}>
      <Button href={learnUrl} style={button}>
        Start your training
      </Button>
    </Section>

    <Text style={text}>
      Or sign in first at{' '}
      <Link href={loginUrl} style={link}>
        {loginUrl}
      </Link>
      .
    </Text>

    <Text style={footer}>{siteName} · Crew portal</Text>
  </EmailShell>
)

export const template = {
  component: Email,
  subject: 'Your Red Cherry crew portal — please take your training',
  displayName: 'Crew training invite',
  previewData: {
    firstName: 'Quinn',
    email: 'quinn@redcherryevents.co.za',
    tempPassword: 'Cherry-1234',
    loginUrl: 'https://riderapp.redcherryevents.co.za/auth',
    learnUrl: 'https://riderapp.redcherryevents.co.za/crew/learn',
  },
} satisfies TemplateEntry
