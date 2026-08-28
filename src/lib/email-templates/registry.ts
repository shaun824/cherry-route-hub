import type { ComponentType } from 'react'

import { template as feedbackNotification } from './feedback-notification'
import { template as entryWelcome } from './entry-welcome'
import { template as crewTrainingInvite } from './crew-training-invite'
import { template as scheduleApology } from './schedule-apology'
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
}
