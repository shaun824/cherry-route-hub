import * as React from 'react'

import { Button, Heading, Link, Text } from '@react-email/components'

import { EmailShell, button, footer, h1, link, text } from './theme'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <EmailShell preview={`Confirm your email for ${siteName}`} siteName={siteName}>
    <Heading style={h1}>Confirm your email</Heading>
    <Text style={text}>
      Thanks for creating your{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>{' '}
      account. Confirm{' '}
      <Link href={`mailto:${recipient}`} style={link}>
        {recipient}
      </Link>{' '}
      to unlock your event details, schedules and rider info.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Verify email
    </Button>
    <Text style={footer}>
      If you didn&apos;t create an account, you can safely ignore this email.
    </Text>
  </EmailShell>
)

export default SignupEmail
