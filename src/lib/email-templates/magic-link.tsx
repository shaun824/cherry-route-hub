import * as React from 'react'

import { Button, Heading, Text } from '@react-email/components'

import { EmailShell, button, footer, h1, text } from './theme'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <EmailShell preview={`Your login link for ${siteName}`} siteName={siteName}>
    <Heading style={h1}>Your login link</Heading>
    <Text style={text}>
      Tap the button below to log in to {siteName}. This link expires shortly.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Log in
    </Button>
    <Text style={footer}>
      If you didn&apos;t request this link, you can safely ignore this email.
    </Text>
  </EmailShell>
)

export default MagicLinkEmail
