import { render } from '@react-email/components'
import { writeFileSync, mkdirSync } from 'fs'
import { SabrinaLovePreEvent } from './src/lib/email-templates/sabrina-love-pre-event'

mkdirSync('/tmp/slsc-html', { recursive: true })
mkdirSync('/tmp/slsc-html-pdf', { recursive: true })
for (const day of [1, 2, 3, 4] as const) {
  const emailHtml = await render(<SabrinaLovePreEvent firstName={'{{contact.contact_name|default("there")}}'} day={day} />)
  writeFileSync(`/tmp/slsc-html/day${day}.html`, emailHtml)
  const pdfHtml = await render(<SabrinaLovePreEvent day={day} />)
  writeFileSync(`/tmp/slsc-html-pdf/day${day}.html`, pdfHtml)
  console.log(`day${day}: email ${emailHtml.length}b, pdf ${pdfHtml.length}b`)
}
