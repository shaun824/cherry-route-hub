import * as React from 'react'
import { Body, Container, Head, Html, Preview, render } from '@react-email/components'
import { SabrinaLovePreEvent } from '@/lib/email-templates/sabrina-love-pre-event'
import { sl } from '@/lib/email-templates/sabrina-love-brand'
const auth = `Basic ${btoa(`${process.env.EVERLYTIC_USERNAME}:${process.env.EVERLYTIC_API_KEY}`)}`
const BASE = 'https://newsletters.computicket-mails.com'
async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(BASE + path, { method, redirect: 'error', headers: { Authorization: auth, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const t = await res.text(); if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${t.slice(0, 200)}`); return t
}
const DAYS = [[1, 924371, 'Beach Walk & Surf Ski', 'Sun 27 Dec'], [2, 924372, 'Discovery Vitality Run', 'Mon 28 Dec'], [3, 924373, 'MTB & E-Bike Challenge', 'Tue 29 Dec'], [4, 924374, 'Trail Run & Kids of Steel', 'Wed 30 Dec']] as const
const TO = ['shaun@redcherryevents.co.za', 'claudine@sabrinalove.co.za', 'tony@orcafoundation.com', 'suzy@eccentricsinteriors.co.za', 'janet@sabrinalove.co.za', 'quinn@redcherryevents.co.za']
const send = process.argv.includes('--send')
for (const [day, id, name, date] of DAYS) {
  const pre = `Entries are open for ${name}, ${date} in Plettenberg Bay. Every cent goes to the Sabrina Love Foundation.`
  const html = (await render(<Html lang="en"><Head><meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light" /></Head><Preview>{pre}</Preview><Body style={{ ...sl.body, backgroundColor: '#FFFFFF' }}><Container style={{ ...sl.container, backgroundColor: '#FFFFFF' }}><SabrinaLovePreEvent firstName={'{{contact.contact_name|default("there")}}'} day={day} /></Container></Body></Html>)).replace('<html', '<html style="color-scheme:light only;background:#ffffff"')
  if (/—|–/.test(html)) console.log('DASH in day', day)
  await Bun.write(`/tmp/slsc/day${day}.html`, html)
  if (!send) continue
  await api(`/api/2.0/emails/${id}`, 'PUT', { name: `Sabrina Love Summer Challenge 2026: invitation to enter Day ${day} (${name})`, subject: `Entries open: ${name} · Sabrina Love Summer Challenge 2026 ♥`, from_name: 'Sabrina Love Summer Challenge', preheader_text: pre, html_original: html })
  for (const to of TO) await api(`/api/2.0/email_preview/${id}/${encodeURIComponent(to)}`, 'POST')
  console.log('day', day, 'updated + 6 previews')
}
