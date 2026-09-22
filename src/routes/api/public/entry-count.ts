import { createFileRoute } from '@tanstack/react-router'

const DEFAULT_EVENT_ID = '003c81de-59a6-4165-9d41-9699fa0d4b32' // PE Plett
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

export const Route = createFileRoute('/api/public/entry-count')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const eventParam = url.searchParams.get('event')?.trim() || DEFAULT_EVENT_ID
        if (!UUID_RE.test(eventParam)) {
          return Response.json(
            { error: 'invalid event id' },
            { status: 400, headers: { ...corsHeaders, 'cache-control': 'no-store' } },
          )
        }
        const capParam = Number(url.searchParams.get('cap'))
        const cap = Number.isFinite(capParam) && capParam > 0 ? Math.min(Math.floor(capParam), 100000) : 250
        const paidOnly = url.searchParams.get('paid') === '1'

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        const { data: eventRow } = await supabaseAdmin
          .from('events')
          .select('id, name')
          .eq('id', eventParam)
          .maybeSingle()
        if (!eventRow) {
          return Response.json(
            { error: 'unknown event' },
            { status: 404, headers: { ...corsHeaders, 'cache-control': 'no-store' } },
          )
        }

        let takenQuery = supabaseAdmin
          .from('event_entrants')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventParam)
        if (paidOnly) takenQuery = takenQuery.eq('paid', true)

        const [{ count: taken }, { count: paid }] = await Promise.all([
          takenQuery,
          supabaseAdmin
            .from('event_entrants')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', eventParam)
            .eq('paid', true),
        ])

        return Response.json(
          { event: eventRow.name, taken: taken ?? 0, paid: paid ?? 0, cap },
          {
            headers: {
              ...corsHeaders,
              'cache-control': 'public, max-age=60',
            },
          },
        )
      },
    },
  },
})
