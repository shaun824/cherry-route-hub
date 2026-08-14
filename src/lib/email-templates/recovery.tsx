import * as React from 'react'

import { Button, Heading, Text } from '@react-email/components'

import { EmailShell, button, footer, h1, text } from './theme'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <EmailShell preview={`Reset your password for ${siteName}`} siteName={siteName}>
    <Heading style={h1}>Reset your password</Heading>
    <Text style={text}>
      We received a request to reset the password for your {siteName} account.
      Choose a new one below.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Reset password
    </Button>
    <Text style={footer}>
      If you didn&apos;t request a password reset, you can safely ignore this
      email — your password will not change.
    </Text>
  </EmailShell>
)

export default RecoveryEmail
