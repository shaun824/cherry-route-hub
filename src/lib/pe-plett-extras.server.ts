import type { ExtraItem } from './my-events'
import { entryNinjaRegistrationUrl } from './entry-ninja-link'
import { inclusionMeta, merchKey, merchKeysMatch } from './inclusion-meta'
import type { PePlettExtra, PePlettExtrasEmailProps } from './email-templates/pe-plett-extras'

const EXTRAS_URL = 'https://peplett.co.za/optional-extras/'

export const PE_PLETT_EXTRAS: PePlettExtra[] = [
  {
    name: 'Pre-Event Accommodation',
    price: 'R3,250 double · R2,250 single',
    description: 'Wednesday night at Cape St Francis Resort, including dinner after registration and breakfast before Stage 1.',
    redeem: 'Booking is essential and places are limited. Check in at Cape St Francis Resort after registration; your room allocation is confirmed by the event team.',
  },
  {
    name: 'Green Motion No Hassles Package',
    price: 'R4,350 per person',
    description: 'PE Airport transfers for you and your bike, Wednesday-night accommodation, dinner, breakfast, and a return transfer to the airport after the finish.',
    redeem: 'Arrive at PE Airport by 13:45 on Wednesday 17 February for the 14:30 departure. Book your Sunday flight after 15:30 and tell the team whether your bike travels with you.',
  },
  {
    name: 'Accommodation Upgrade',
    price: 'Price depends on selected hotels and nights',
    description: 'Hotel accommodation for all three race nights at Fynbos Ridge, then Tsitsikamma Lodge, Mountain Breeze or Tsitsikamma Cabins, subject to availability.',
    redeem: 'Your allocation is arranged in advance. All event meals remain at the race village; check your final rooming details in the Rider Hub.',
  },
  {
    name: 'Bicycle Wash',
    price: 'R500 per person for three days',
    description: 'A daily bike wash after each of the first three stages by the Kwano Academy team. Rider self-service facilities are available on Day 4.',
    redeem: 'Drop your bike at the wash bay after finishing each of the first three stages, then collect it from the bike park once cleaned.',
  },
  {
    name: 'Bicycle Service',
    price: 'R2,850 per person',
    description: 'Daily gear and brake adjustment, wear and bolt checks, a test ride, and labour for fitted parts by Techno Guide.',
    redeem: 'Hand your bike to the Techno Guide service team after your stage. Labour is included; any replacement parts are charged separately.',
  },
  {
    name: 'Vehicle Transfer',
    price: 'R1,650 per vehicle',
    description: 'Secure transfer of your vehicle from St Francis Links to the finish at Nature’s Valley, with secure parking at the finish.',
    redeem: 'Bring the vehicle fully fuelled and leave about R60 cash for the toll. Drop your keys at registration on the morning of Stage 1.',
  },
  {
    name: 'E-Bike Rental',
    price: 'R7,550 per bike',
    description: 'A Scott Strike e-bike for the full event, including transport to the start, setup, daily washing, charging, service and mechanical checks.',
    redeem: 'Meet the rental team at registration for setup and handover. Return the bike to the team after each stage for washing, charging and checks.',
  },
  {
    name: 'Massage Zone',
    price: 'Packages booked separately',
    description: 'Sports massage from FHR Sports Performance Solutions to support recovery, circulation, mobility and muscle balance.',
    redeem: 'Reserve a session through the massage booking link on the PE Plett extras page, then report to the Massage Zone at your confirmed time.',
  },
]

function money(value: number | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value)
}

function catalogueMatch(name: string) {
  const key = merchKey(name)
  return PE_PLETT_EXTRAS.find((item) => merchKeysMatch(key, merchKey(item.name)))
}

export function buildPePlettExtrasEmailData(input: {
  firstName?: string
  eventName: string
  registrationRef?: string | null
  registrationUrl?: string | null
  extras?: ExtraItem[] | null
}): PePlettExtrasEmailProps {
  const bookedExtras = (input.extras ?? []).map((extra) => {
    const known = catalogueMatch(extra.name)
    const fallback = inclusionMeta(extra.name)
    return {
      name: extra.name,
      option: extra.size ?? null,
      quantity: extra.qty || 1,
      price: money(extra.price) ?? known?.price ?? null,
      description: known?.description ?? fallback.blurb,
      redeem: known?.redeem ?? fallback.howTo,
    }
  })
  const bookedKeys = bookedExtras.map((extra) => merchKey(extra.name))
  const availableExtras = PE_PLETT_EXTRAS.filter(
    (item) => !bookedKeys.some((key) => merchKeysMatch(key, merchKey(item.name))),
  )
  return {
    firstName: input.firstName,
    eventName: input.eventName,
    bookedExtras,
    availableExtras,
    registrationUrl:
      input.registrationUrl ?? entryNinjaRegistrationUrl(input.registrationRef) ?? 'https://entries.peplett.co.za/registrations',
    extrasUrl: EXTRAS_URL,
  }
}

export async function sendPePlettExtrasEmail(input: {
  to: string
  eventEntrantId: string
  firstName?: string
  eventName: string
  registrationRef?: string | null
  registrationUrl?: string | null
  extras?: ExtraItem[] | null
}) {
  const { sendTemplateEmail } = await import('./email-templates/send-email')
  return sendTemplateEmail('pe-plett-extras', input.to, {
    idempotencyKey: `pe-plett-extras-${input.eventEntrantId}`,
    templateData: buildPePlettExtrasEmailData(input),
  })
}