import * as React from 'react'
import { Heading, Text, Button } from '@react-email/components'
import { EmailShell, h1, text, button } from './theme'
import type { TemplateEntry } from './registry'
import type { ResultsIssue } from '../results-anomalies'

function Email({ eventName = 'Your event', checkedAt = '', issues = [] }: { eventName?: string; checkedAt?: string; issues?: ResultsIssue[] }) {
  return <EmailShell preview={`Results issues requiring review — ${eventName}`} siteName="Red Cherry Events · Race control">
    <Heading style={h1}>{eventName}: results review</Heading>
    <Text style={text}>Shaun, the event results check found {issues.length} issue{issues.length === 1 ? '' : 's'} requiring review. Checked {checkedAt}.</Text>
    {issues.map((issue, i) => <React.Fragment key={i}>
      <Heading as="h2" style={{ ...h1, fontSize: '17px' }}>{issue.name}{issue.bib ? ` · #${issue.bib}` : ''}</Heading>
      <Text style={text}>{issue.detail}</Text>
    </React.Fragment>)}
    <Text style={text}>Explicit course mismatches are excluded from automatic weekend standings. An unusually fast time alone is only a warning: confirm with the timing team before changing any result. Daily and official timing records are preserved. Check any already-published podium before prize-giving.</Text>
    <Button href="https://riderhub.redcherryevents.co.za/admin/results" style={button}>Review results</Button>
  </EmailShell>
}

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) => `Results need review — ${data.eventName ?? 'Red Cherry event'}`,
  displayName: 'Event results issue alert',
  to: 'shaun@redcherryevents.co.za',
  previewData: { eventName: 'Otto1890 Weekend Warrior Lourensford', checkedAt: '17 October, 16:00 SAST', issues: [{ kind: 'course-mismatch', name: 'Sample rider', bib: '271', detail: 'Silver entry; timed on Bronze. Check the classification with the timing team.' }] },
} satisfies TemplateEntry