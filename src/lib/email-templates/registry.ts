import type { ComponentType } from 'react'

import { template as feedbackNotification } from './feedback-notification'
import { template as entryWelcome } from './entry-welcome'
import { template as crewTrainingInvite } from './crew-training-invite'
import { template as scheduleApology } from './schedule-apology'
import { template as eventUpdate } from './event-update'
import { template as pePlettExtras } from './pe-plett-extras'
import { SignupEmail } from './signup'
import { InviteEmail } from './invite'
import { MagicLinkEmail } from './magic-link'
import { RecoveryEmail } from './recovery'
import { EmailChangeEmail } from './email-change'
import { ReauthenticationEmail } from './reauthentication'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'feedback-notification': feedbackNotification,
  'entry-welcome': entryWelcome,
  'crew-training-invite': crewTrainingInvite,
  'schedule-apology': scheduleApology,
  'event-update': eventUpdate,
  'pe-plett-extras': pePlettExtras,
  // Auth emails are sent live by the Supabase auth webhook (see
  // src/routes/lovable/email/auth/webhook.ts). They are registered here only so
  // admins can send themselves an exact copy of what riders receive.
  'auth-signup': {
    component: SignupEmail,
    subject: 'Confirm your email',
    displayName: 'Account: confirm your email',
  },
  'auth-invite': {
    component: InviteEmail,
    subject: 'Your Red Cherry Events Rider Hub account is ready',
    displayName: 'Account: invite',
  },
  'auth-magic-link': {
    component: MagicLinkEmail,
    subject: 'Your login link',
    displayName: 'Account: login link',
  },
  'auth-recovery': {
    component: RecoveryEmail,
    subject: 'Reset your password',
    displayName: 'Account: reset your password',
  },
  'auth-email-change': {
    component: EmailChangeEmail,
    subject: 'Confirm your new email',
    displayName: 'Account: confirm new email',
  },
  'auth-reauthentication': {
    component: ReauthenticationEmail,
    subject: 'Your verification code',
    displayName: 'Account: verification code',
  },
}
