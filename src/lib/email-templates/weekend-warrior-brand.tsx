import * as React from 'react'
import { Button, Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components'
import { RCE_LOGO_URL } from './theme'
import trails from '@/assets/ww-email/ww-trails.jpg.asset.json'
import otto from '@/assets/ww-email/ww_logo_otto1890.png.asset.json'
import cycle from '@/assets/ww-email/ww_logo_cycle_lab.png.asset.json'
import westvaal from '@/assets/ww-email/ww_logo_westvaal.png.asset.json'
import hyperclear from '@/assets/ww-email/ww_logo_hyperclear.png.asset.json'
import isuzu from '@/assets/ww-email/ww_logo_isuzu.png.asset.json'
import scriptex from '@/assets/ww-email/ww_logo_scriptex.png.asset.json'
import sab from '@/assets/ww-email/ww_logo_sab.png.asset.json'
import squirt from '@/assets/ww-email/ww_logo_squirt.png.asset.json'
import principa from '@/assets/ww-email/ww_logo_principa.png.asset.json'
import triumph from '@/assets/ww-email/ww_logo_triumph.png.asset.json'
import truCape from '@/assets/ww-email/ww_logo_tru_cape.png.asset.json'
import green from '@/assets/ww-email/ww_logo_green_motion.png.asset.json'
import peninsula from '@/assets/ww-email/ww_logo_peninsula_power.png.asset.json'
import cogent from '@/assets/ww-email/ww_logo_cogent.png.asset.json'
import kazin from '@/assets/ww-email/ww_logo_kazin.png.asset.json'
import nutri from '@/assets/ww-email/ww_logo_nutri_go.png.asset.json'
import rudy from '@/assets/ww-email/ww_logo_rudy_project.png.asset.json'
import cyberlogic from '@/assets/ww-email/ww_logo_cyberlogic.png.asset.json'
import enjoy from '@/assets/ww-email/ww_logo_enjoy.png.asset.json'

const absolute = (url: string) => new URL(url, 'https://riderhub.redcherryevents.co.za').href
export const ww = {
  forest: '#052C29', teal: '#9FD4D8', red: '#EB3817', ink: '#1F2A28', muted: '#596763', white: '#FFFFFF', line: '#DDE7E4',
  body: { margin: '0', padding: '0', backgroundColor: '#FFFFFF', fontFamily: 'Helvetica, Arial, sans-serif' },
  container: { maxWidth: '600px', margin: '0 auto', padding: '0 0 24px' },
  inner: { padding: '26px 24px 12px' },
  text: { fontSize: '15px', lineHeight: '1.65', color: '#1F2A28', margin: '0 0 18px' },
  heading: { fontFamily: 'Georgia, Times New Roman, serif', fontSize: '28px', lineHeight: '1.25', fontWeight: 400 as const, color: '#052C29', margin: '0 0 18px' },
  label: { fontSize: '12px', lineHeight: '1.5', fontWeight: 700 as const, color: '#EB3817', margin: '0 0 10px' },
  button: { backgroundColor: '#EB3817', color: '#FFFFFF', fontSize: '15px', fontWeight: 700 as const, textDecoration: 'none', padding: '15px 24px', borderRadius: '4px' },
}

export function WarriorHeader({ label }: { label: string }) {
  return <>
    <Section style={{ backgroundColor: ww.forest, padding: '22px 24px' }}>
      <Text style={{ ...ww.label, color: ww.teal }}>RED CHERRY EVENTS · 2027</Text>
      <Heading style={{ ...ww.heading, color: ww.white, margin: '0', fontSize: '30px' }}>Otto1890<br />Weekend Warrior</Heading>
    </Section>
    <Img src={absolute(trails.url)} alt="Otto1890 Weekend Warrior riders on the mountain trails" width="600" style={{ width: '100%', height: 'auto', display: 'block' }} />
    <Section style={{ backgroundColor: ww.teal, padding: '12px 24px' }}>
      <Text style={{ ...ww.label, color: ww.forest, margin: '0', textAlign: 'center' }}>{label}</Text>
    </Section>
  </>
}

export function WarriorDates() {
  return <Section>
    <Text style={ww.label}>TWO WEEKENDS TO LOOK FORWARD TO</Text>
    {[
      { place: 'Oak Valley', dates: '2–4 April 2027', month: 'APRIL' },
      { place: 'Lourensford', dates: '8–10 October 2027', month: 'OCTOBER' },
    ].map(({ place, dates, month }) => <Section key={place} style={{ borderTop: `1px solid ${ww.line}`, padding: '18px 0' }}>
      <Text style={{ ...ww.label, margin: '0 0 5px' }}>{month} / 2027</Text>
      <Heading as="h2" style={{ ...ww.heading, fontSize: '23px', margin: '0 0 7px' }}>Otto1890 Weekend Warrior {place}</Heading>
      <Text style={{ ...ww.text, margin: '0', fontWeight: 700 }}>{dates}</Text>
    </Section>)}
  </Section>
}

export const ENTRY_OPEN_DATE = '20261201T070000Z'
export const ENTRY_OPEN_END = '20261201T071500Z'
export const ENTRY_URL = 'https://entries.redcherryevents.co.za/events/84713'
export const REMINDER_URL = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
  action: 'TEMPLATE', text: 'Otto1890 Weekend Warrior 2027 — entries open',
  dates: `${ENTRY_OPEN_DATE}/${ENTRY_OPEN_END}`, ctz: 'Africa/Johannesburg',
  details: `Entries open 1 December 2026 at 09:00 SAST. Oak Valley: 2–4 April 2027. Lourensford: 8–10 October 2027. ${ENTRY_URL}`,
}).toString()

export function WarriorReminder({ open = false }: { open?: boolean }) {
  return <Section style={{ backgroundColor: ww.forest, padding: '22px', margin: '12px 0 24px', borderRadius: '4px' }}>
    <Text style={{ ...ww.label, color: ww.teal }}>{open ? 'A LITTLE REMINDER' : 'SAVE THE DATE · SET YOUR REMINDER'}</Text>
    <Heading as="h2" style={{ ...ww.heading, color: ww.white, fontSize: '23px', margin: '0 0 12px' }}>{open ? 'Make a weekend of it.' : '1 December · 09:00 SAST'}</Heading>
    <Text style={{ ...ww.text, color: ww.white }}>{open ? 'Oak Valley: 2–4 April. Lourensford: 8–10 October. Put your chosen weekend in the diary, round up your riding friends and plan your next adventure together.' : 'Entries for both 2027 events open on Tuesday, 1 December 2026 at 09:00 South African time. Add a diary reminder so you’re ready when entries open.'}</Text>
    {!open ? <Button href={REMINDER_URL} style={ww.button}>Add an entries-opening reminder</Button> : null}
  </Section>
}

const partners = [
  ['Cycle Lab', cycle], ['Westvaal Motor Group', westvaal], ['Tru-Cape', truCape], ['Green Motion', green],
  ['Hyperclear', hyperclear], ['Scriptex', scriptex], ['Principa', principa], ['Cogent', cogent], ['Cyberlogic', cyberlogic],
  ['Isuzu', isuzu], ['SAB', sab], ['Squirt Cycling Products', squirt], ['Triumph Cape Town', triumph],
  ['Peninsula Power Products', peninsula], ['Kazin', kazin], ['Nutri-Go', nutri], ['Rudy Project', rudy], ['Enjoy', enjoy],
] as const

export function WarriorPartners() {
  const rows = Array.from({ length: Math.ceil(partners.length / 3) }, (_, i) => partners.slice(i * 3, i * 3 + 3))
  return <Section style={{ backgroundColor: ww.white, borderTop: `3px solid ${ww.teal}`, padding: '24px 12px 8px', textAlign: 'center' }}>
    <Text style={{ ...ww.label, color: ww.forest }}>THE PARTNER NETWORK BEHIND THE ADVENTURE</Text>
    <Text style={{ ...ww.text, color: ww.muted, fontSize: '13px' }}>With thanks to our title partner, sponsors and event partners.</Text>
    <Text style={{ ...ww.label, color: ww.muted }}>TITLE PARTNER</Text>
    <Img src={absolute(otto.url)} alt="Otto1890 Investment Specialists" width="220" style={{ margin: '0 auto 24px', maxWidth: '100%', height: 'auto' }} />
    {rows.map((row, i) => <Row key={i} style={{ tableLayout: 'fixed', width: '100%' }}>
      {row.map(([name, asset]) => <Column key={name} style={{ width: '33.33%', padding: '12px 5px', verticalAlign: 'middle' }}>
        <Img src={absolute(asset.url)} alt={name} width="115" style={{ width: '100%', maxWidth: '115px', height: 'auto', margin: '0 auto' }} />
        <Text style={{ fontSize: '10px', lineHeight: '1.4', color: ww.muted, margin: '7px 0 0' }}>{name}</Text>
      </Column>)}
    </Row>)}
    <Section style={{ backgroundColor: ww.white, padding: '24px 16px 12px', borderTop: `1px solid ${ww.line}`, marginTop: '18px' }}>
      <Img src={RCE_LOGO_URL} alt="Red Cherry Events" width="150" style={{ display: 'block', margin: '0 auto', height: 'auto' }} />
      <Text style={{ ...ww.text, fontSize: '12px', color: ww.muted, margin: '14px 0 0' }}>See you on the trails.<br />Shaun and the Red Cherry Events team</Text>
      <Link href="https://www.redcherryevents.co.za" style={{ color: ww.forest, fontSize: '12px' }}>redcherryevents.co.za</Link>
    </Section>
  </Section>
}