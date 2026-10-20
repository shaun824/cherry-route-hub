import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { WarriorDates, WarriorHeader, WarriorPartners, WarriorReminder, ww } from './weekend-warrior-brand'

const Email = () => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're on the list — Otto1890 Weekend Warrior 2027 entries open 1 December at 09:00 SAST.</Preview>
    <Body style={ww.body}>
      <Container style={ww.container}>
        <WarriorHeader label="YOU'RE ON THE LIST · OTTO1890 WEEKEND WARRIOR 2027" />
        <Section style={ww.inner}>
          <Text style={{ ...ww.text, color: ww.red, fontWeight: 700 }}>Thanks for joining us!</Text>
          <Heading style={ww.heading}>Your next trail adventure<br />is in the diary.</Heading>
          <Text style={ww.text}>
            Your sign-up is confirmed. We’ll email you when entries for <strong>Otto1890 Weekend Warrior 2027</strong> open on <strong>1 December 2026 at 09:00 SAST</strong>.
          </Text>
          <Text style={ww.text}>Here are the two weekends you asked to hear about — keep these dates handy:</Text>
          <WarriorDates />
          <WarriorReminder />
          <Text style={ww.text}>No entry has been booked yet; this confirms your entries-opening alert. Keep an eye on your inbox on 1 December — we’ll send you the entry link then.</Text>
        </Section>
        <WarriorPartners />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: "You're on the list — Otto1890 Weekend Warrior 2027 dates",
  displayName: 'Otto1890 Weekend Warrior 2027 sign-up confirmation',
  previewData: {},
} satisfies TemplateEntry
