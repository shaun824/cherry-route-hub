import * as React from 'react'
import { Body, Container, Head, Html, Preview, render } from '@react-email/components'
import { writeFileSync } from 'fs'
import { SabrinaLovePreEvent } from '@/lib/email-templates/sabrina-love-pre-event'
import { sl } from '@/lib/email-templates/sabrina-love-brand'

const DAYS = [
  { day: 1 as const, name: 'Beach Walk & Surf Ski', date: 'Sun 27 Dec' },
  { day: 2 as const, name: 'Discovery Vitality Run', date: 'Mon 28 Dec' },
  { day: 3 as const, name: 'MTB & E-Bike Challenge', date: 'Tue 29 Dec' },
  { day: 4 as const, name: 'Trail Run & Kids of Steel', date: 'Wed 30 Dec' },
]

const firstName = '{{contact.contact_name|default("there")}}'

for (const d of DAYS) {
  const element = (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Everything you need for ${d.name} — ${d.date}, Plettenberg Bay.`}</Preview>
      <Body style={sl.body}>
        <Container style={sl.container}>
          <SabrinaLovePreEvent firstName={firstName} day={d.day} />
        </Container>
      </Body>
    </Html>
  )
  writeFileSync(`/tmp/slsc-html/day${d.day}.html`, await render(element))

  const generic = (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Everything you need for ${d.name} — ${d.date}, Plettenberg Bay.`}</Preview>
      <Body style={sl.body}>
        <Container style={sl.container}>
          <SabrinaLovePreEvent day={d.day} />
        </Container>
      </Body>
    </Html>
  )
  writeFileSync(`/tmp/slsc-html-pdf/day${d.day}.html`, await render(generic))
  console.log(`rendered day ${d.day}`)
}
console.log('done')
