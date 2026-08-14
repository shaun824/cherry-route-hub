import * as React from 'react'

import { Heading, Text } from '@react-email/components'

import { EmailShell, codeStyle, footer, h1, text } from './theme'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({
  token,
}: ReauthenticationEmailProps) => (
  <EmailShell
    preview="Your verification code"
    siteName="Red Cherry Events Rider Hub"
  >
    <Heading style={h1}>Confirm it&apos;s you</Heading>
    <Text style={text}>Use the code below to confirm your identity:</Text>
    <Text style={codeStyle}>{token}</Text>
    <Text style={footer}>
      This code expires shortly. If you didn&apos;t request it, you can safely
      ignore this email.
    </Text>
  </EmailShell>
)

export default ReauthenticationEmail
