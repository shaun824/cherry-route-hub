import { createFileRoute } from '@tanstack/react-router'

const DEFAULT_EVENT_ID = '003c81de-59a6-4165-9d41-9699fa0d4b32' // PE Plett
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
}
const noStore = { ...corsHeaders, 'cache-control': 'no-store' }

export const Route = createFileRoute('/api/public/class-availability')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const eventId = url.searchParams.get('event')?.trim() || DEFAULT_EVENT_ID
        if (!UUID_RE.test(eventId)) {
          return Response.json({ error: 'invalid event id' }, { status: 400, headers: noStore })
        }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { getClassAvailability } = await import('@/lib/class-availability.server')
        try {
          const data = await getClassAvailability(supabaseAdmin, eventId)
          if (!data) return Response.json({ error: 'unknown event' }, { status: 404, headers: noStore })
          return Response.json(data, { headers: { ...corsHeaders, 'cache-control': 'public, max-age=60' } })
        } catch {
          return Response.json({ error: 'temporarily unavailable' }, { status: 503, headers: noStore })
        }
      },
    },
  },
})
