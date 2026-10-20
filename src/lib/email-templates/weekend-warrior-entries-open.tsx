// Marketing creative for Everlytic only. Never register with Lovable app emails.
import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import { ENTRY_URL, WarriorDates, WarriorHeader, WarriorPartners, WarriorReminder, ww } from './weekend-warrior-brand'

export function WeekendWarriorEntriesOpen({ firstName = 'there' }: { firstName?: string }) {
  return <Html lang="en" dir="ltr"><Head /><Preview>Otto1890 Weekend Warrior 2027 entries are open — Oak Valley in April, Lourensford in October.</Preview>
    <Body style={ww.body}><Container style={ww.container}>
      <WarriorHeader label="ENTRIES ARE OPEN · YOUR NEXT ADVENTURE STARTS HERE" />
      <Section style={ww.inner}>
        <Text style={{ ...ww.text, color: ww.red, fontWeight: 700 }}>Hey {firstName},</Text>
        <Heading style={ww.heading}>Back on the trails.<br />Back with your people.</Heading>
        <Text style={ww.text}>The wait is over! Entries for Otto1890 Weekend Warrior 2027 are open. Two beautiful venues, two weekends to escape the everyday, and another chance to make memories on and off the bike.</Text>
        <Text style={ww.text}>Whether you’re coming for the ride, the time with your family or the catch-ups with your riding mates, we’d love to have you with us.</Text>
        <Section style={{ textAlign: 'center', margin: '6px 0 28px' }}><Button href={ENTRY_URL} style={ww.button}>Enter Otto1890 Weekend Warrior</Button></Section>
        <WarriorDates />
        <WarriorReminder open />
        <Heading as="h2" style={{ ...ww.heading, fontSize: '23px' }}>Your 2027 adventure is waiting.</Heading>
        <Text style={ww.text}>Choose your weekend, share the plan with your crew and get your entry in. We can’t wait to see you on the start line.</Text>
        <Section style={{ textAlign: 'center', margin: '0 0 22px' }}><Button href={ENTRY_URL} style={ww.button}>Choose your weekend &amp; enter</Button></Section>
      </Section>
      <WarriorPartners />
    </Container></Body>
  </Html>
}