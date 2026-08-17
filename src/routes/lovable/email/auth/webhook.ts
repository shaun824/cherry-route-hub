import * as React from 'react'
import { createAuthEmailHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "Red Cherry Events Rider Hub"
const SENDER_DOMAIN = "notify.riderapp.redcherryevents.co.za"
const ROOT_DOMAIN = "riderapp.redcherryevents.co.za"
const FROM_DOMAIN = "notify.riderapp.redcherryevents.co.za"
const SITE_URL = `https://${ROOT_DOMAIN}`

// The SDK handler owns verification, dispatch, and retry semantics; this file
// owns only the email decisions: subjects, templates, and per-type props.
const handler = createAuthEmailHandler({
  apiKey: process.env['LOVABLE_API_KEY']!,
  from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
  senderDomain: SENDER_DOMAIN,
  sendUrl: process.env['LOVABLE_SEND_URL'],
  emails: {
    signup: {
      subject: 'Confirm your email',
      render: (data) =>
        React.createElement(SignupEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipient: data.email,
          confirmationUrl: data.url,
        }),
    },
    invite: {
      subject: 'Your Red Cherry Events Rider Hub account is ready',
      render: async (data) => {
        // Personalise with the rider's name and the events already on their
        // roster row. Falls back to a generic invite if the lookup fails.
        let firstName: string | undefined
        let events: string[] = []
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
          const { data: entrant } = await supabaseAdmin
            .from('entrants')
            .select('id, full_name')
            .ilike('email', data.email)
            .maybeSingle()
          if (entrant?.full_name) firstName = entrant.full_name.trim().split(/\s+/)[0]
          if (entrant?.id) {
            const { data: rows } = await supabaseAdmin
              .from('event_entrants')
              .select('events(name, event_date)')
              .eq('entrant_id', entrant.id)
            events = (rows ?? [])
              .map((r) => (r as { events?: { name?: string } | null }).events?.name)
              .filter((n): n is string => Boolean(n))
          }
        } catch {
          /* personalisation is best-effort — the invite must still send */
        }
        return React.createElement(InviteEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          confirmationUrl: data.url,
          firstName,
          events,
        })
      },
    },

    magiclink: {
      subject: 'Your login link',
      render: (data) =>
        React.createElement(MagicLinkEmail, {
          siteName: SITE_NAME,
          confirmationUrl: data.url,
        }),
    },
    recovery: {
      subject: 'Reset your password',
      render: (data) =>
        React.createElement(RecoveryEmail, {
          siteName: SITE_NAME,
          confirmationUrl: data.url,
        }),
    },
    email_change: {
      subject: 'Confirm your new email',
      render: (data) =>
        React.createElement(EmailChangeEmail, {
          siteName: SITE_NAME,
          oldEmail: data.old_email ?? '',
          email: data.email,
          newEmail: data.new_email ?? '',
          confirmationUrl: data.url,
        }),
    },
    reauthentication: {
      subject: 'Your verification code',
      render: (data) =>
        React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
    },
  },
})

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
    },
  },
})
