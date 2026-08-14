import * as React from 'react'

import { Button, Heading, Link, Text } from '@react-email/components'

import { EmailShell, button, footer, h1, link, text } from './theme'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <EmailShell
    preview={`You've been invited to join ${siteName}`}
    siteName={siteName}
  >
    <Heading style={h1}>You&apos;ve been invited</Heading>
    <Text style={text}>
      You&apos;ve been invited to join{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      . Accept the invitation to set up your rider account.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Accept invitation
    </Button>
    <Text style={footer}>
      If you weren&apos;t expecting this invitation, you can safely ignore this
      email.
    </Text>
  </EmailShell>
)

export default InviteEmail
