import * as React from 'react'
import { writeFileSync, mkdirSync } from 'fs'
import { Body, Container, Head, Html, Preview, render } from '@react-email/components'
import { SabrinaLovePreEvent } from '@/lib/email-templates/sabrina-love-pre-event'
import { sl } from '@/lib/email-templates/sabrina-love-brand'

const username = process.env.EVERLYTIC_USERNAME!
const apiKey = process.env.EVERLYTIC_API_KEY!
const BASE = 'https://newsletters.computicket-mails.com'
const SEND = process.argv.includes('--send')
const TO = ['shaun@redcherryevents.co.za', 'claudine@sabrinalove.co.za', 'tony@orcafoundation.com', 'suzy@eccentricsinteriors.co.za', 'janet@sabrinalove.co.za', 'quinn@redcherryevents.co.za']
const DAYS = [
  { id: 924371, day: 1 as const, name: 'Beach Walk & Surf Ski', date: 'Sun 27 Dec' },
  { id: 924372, day: 2 as const, name: 'Discovery Vitality Run', date: 'Mon 28 Dec' },
  { id: 924373, day: 3 as const, name: 'MTB & E-Bike Challenge', date: 'Tue 29 Dec' },
  { id: 924374, day: 4 as const, name: 'Trail Run & Kids of Steel', date: 'Wed 30 Dec' },
]
async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Basic ${btoa(`${username}:${apiKey}`)}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined })
  const t = await res.text(); if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${t.slice(0, 200)}`); return t
}
const wrap = (d: typeof DAYS[number], firstName?: string) => render(
  <Html lang="en" dir="ltr"><Head /><Preview>{`Everything you need for ${d.name}, ${d.date}, Plettenberg Bay.`}</Preview>
    <Body style={sl.body}><Container style={sl.container}><SabrinaLovePreEvent firstName={firstName} day={d.day} /></Container></Body></Html>)
mkdirSync('/tmp/slsc-v4', { recursive: true })
for (const d of DAYS) {
  const html = await wrap(d, '{{contact.contact_name|default("there")}}')
  writeFileSync(`/tmp/slsc-v4/day${d.day}.html`, html)
  writeFileSync(`/tmp/slsc-v4/day${d.day}-pdf.html`, await wrap(d))
  if (!SEND) continue
  await api(`/api/2.0/emails/${d.id}`, 'PUT', { html_original: html, from_name: 'Sabrina Love Summer Challenge',
    subject: `Your guide to ${d.name}: Sabrina Love Summer Challenge 2026 ♥`,
    preheader_text: `Everything you need for ${d.name}, ${d.date}, Plettenberg Bay.` })
  const check = JSON.parse(await api(`/api/2.0/emails/${d.id}`, 'GET'))
  const item = check.item ?? check.data ?? check
  console.log(d.day, 'from_name=', item.from_name, 'rce logo in html=', String(item.html_original ?? '').includes('rce-logo'))
  for (const to of TO) { await api(`/api/2.0/email_preview/${d.id}/${encodeURIComponent(to)}`, 'POST'); console.log(' preview ->', to) }
}
console.log('done')
