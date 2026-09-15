import * as React from 'react'

import { Button, Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components'

import { brand, button, link, text } from './theme'
import type { EmailBlock } from '../email-blocks'

const img = {
  display: 'block',
  width: '100%',
  maxWidth: '100%',
  height: 'auto',
  borderRadius: '14px',
  border: `1px solid ${brand.border}`,
}

const caption = {
  fontSize: '12px',
  color: brand.muted,
  lineHeight: '1.5',
  margin: '6px 0 0',
  textAlign: 'center' as const,
}

const headingSize = { xl: '28px', lg: '22px', md: '18px' } as const
const spacerSize = { sm: '8px', md: '20px', lg: '36px' } as const

function RoutePicture({ day }: { day: { label: string; detail?: string | null; url: string; href?: string | null } }) {
  if (!/^https:\/\//i.test(day.url)) return null
  const picture = <Img src={day.url} alt={`${day.label} route profile`} width="600" style={img} />
  return (
    <Section style={{ margin: '0 0 14px', lineHeight: 0 }}>
      <Text style={{ ...caption, color: brand.ink, fontSize: '14px', fontWeight: 700, margin: '0 0 7px', textAlign: 'left' }}>{day.label}</Text>
      {day.href ? <Link href={day.href}>{picture}</Link> : picture}
      {day.detail ? <Text style={caption}>{day.detail}</Text> : null}
    </Section>
  )
}

/** Renders one builder block as email-safe markup. Text is never raw HTML. */
export function EmailBlockView({ block }: { block: EmailBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <Heading
          style={{
            fontSize: headingSize[block.size ?? 'lg'],
            lineHeight: '1.25',
            color: brand.ink,
            margin: '18px 0 10px',
            textAlign: block.align ?? 'left',
          }}
        >
          {block.text}
        </Heading>
      )

    case 'text':
      return (
        <Text style={{ ...text, textAlign: block.align ?? 'left' }}>
          {block.text.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <br /> : null}
              {line}
            </React.Fragment>
          ))}
        </Text>
      )

    case 'image': {
      if (!/^https:\/\//i.test(block.url)) return null
      const picture = <Img src={block.url} alt={block.caption ?? ''} width="600" style={img} />
      return (
        <Section style={{ margin: '0 0 16px', lineHeight: 0 }}>
          {block.href ? <Link href={block.href}>{picture}</Link> : picture}
          {block.caption ? <Text style={caption}>{block.caption}</Text> : null}
        </Section>
      )
    }

    case 'columns': {
      const items = block.items.filter((i) => /^https:\/\//i.test(String(i?.url ?? '')))
      if (!items.length) return null
      return (
        <Section style={{ margin: '0 0 16px' }}>
          <Row>
            {items.map((item, i) => {
              const picture = <Img src={item.url} alt={item.caption ?? ''} width="280" style={img} />
              return (
                <Column key={i} style={{ padding: i === 0 ? '0 6px 0 0' : '0 0 0 6px', verticalAlign: 'top' }}>
                  {item.href ? <Link href={item.href}>{picture}</Link> : picture}
                  {item.caption ? <Text style={caption}>{item.caption}</Text> : null}
                </Column>
              )
            })}
          </Row>
        </Section>
      )
    }

    case 'route-pair': {
      const days = block.days.filter((day) => /^https:\/\//i.test(day.url))
      if (!days.length) return null
      return (
        <Section style={{ margin: '4px 0 24px' }}>
          <Text style={{ ...text, fontSize: '18px', fontWeight: 700, margin: '0 0 2px' }}>{block.category}</Text>
          <Text style={{ ...caption, margin: '0 0 10px', textAlign: 'left' }}>Day 1 and Day 2 route profiles</Text>
          {days.map((day, index) => <RoutePicture day={day} key={`${day.label}-${index}`} />)}
        </Section>
      )
    }

    case 'button':
      if (!block.url.trim()) return null
      return (
        <Section style={{ margin: '4px 0 18px', textAlign: block.align ?? 'center' }}>
          <Button style={button} href={block.url}>
            {block.label || 'Open'}
          </Button>
        </Section>
      )

    case 'list':
      return (
        <Section style={{ margin: '0 0 14px' }}>
          {block.items.filter(Boolean).map((item, i) => (
            <Text key={i} style={{ ...text, margin: '0 0 6px' }}>
              {block.ordered ? `${i + 1}. ` : '• '}
              {item}
            </Text>
          ))}
        </Section>
      )

    case 'quote':
      return (
        <Section style={{ margin: '0 0 18px', padding: '2px 0 2px 14px', borderLeft: `3px solid ${brand.border}` }}>
          <Text style={{ ...text, fontStyle: 'italic', margin: '0' }}>{block.text}</Text>
          {block.cite ? <Text style={{ ...caption, textAlign: 'left' }}>— {block.cite}</Text> : null}
        </Section>
      )

    case 'callout':
      return (
        <Section
          style={{
            margin: '0 0 18px',
            padding: '14px 16px',
            borderRadius: '14px',
            border: `1px solid ${brand.border}`,
            backgroundColor: '#fdf4f4',
          }}
        >
          {block.title ? (
            <Text style={{ ...text, margin: '0 0 4px', fontWeight: 700 }}>{block.title}</Text>
          ) : null}
          <Text style={{ ...text, margin: '0' }}>{block.text}</Text>
        </Section>
      )

    case 'divider':
      return <Section style={{ margin: '4px 0 20px', borderTop: `1px solid ${brand.border}`, lineHeight: 0 }} />

    case 'spacer':
      return <Section style={{ height: spacerSize[block.size ?? 'md'], lineHeight: 0 }} />

    default:
      return null
  }
}

export const emailBlockLink = link
