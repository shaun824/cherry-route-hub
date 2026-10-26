import { render } from '@react-email/components'
import { writeFileSync, mkdirSync } from 'fs'
import { SabrinaLovePreEvent } from './src/lib/email-templates/sabrina-love-pre-event'

mkdirSync('/tmp/slsc-html', { recursive: true })
for (const day of [1, 2, 3, 4] as const) {
  const html = await render(<SabrinaLovePreEvent firstName={'{{contact.contact_name|default("there")}}'} day={day} />)
  writeFileSync(`/tmp/slsc-html/day${day}.html`, html)
  console.log(`day${day}: ${html.length} bytes`)
}
