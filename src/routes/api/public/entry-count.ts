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
        const capOverride = Number.isFinite(capParam) && capParam > 0 ? Math.min(Math.floor(capParam), 100000) : null

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { getClassAvailability } = await import('@/lib/class-availability.server')

        // Same Entry Ninja numbers as /api/public/class-availability, so the hero
        // counter and the pricing section always agree.
        let availability = null
        try {
          availability = await getClassAvailability(supabaseAdmin, eventParam)
        } catch {
          availability = null
        }
        if (availability) {
          return Response.json(
            { event: availability.event, taken: availability.totals.taken, cap: capOverride ?? availability.totals.cap },
            { headers: { ...corsHeaders, 'cache-control': 'public, max-age=3600' } },
          )
        }

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

        // Fallback for events not linked to Entry Ninja: roster count without test/placeholder rows.
        const { count } = await supabaseAdmin
          .from('event_entrants')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventParam)
          .not('category', 'in', '("Test Entry","Placeholder entry")')

        return Response.json(
          { event: eventRow.name, taken: count ?? 0, cap: capOverride ?? 250 },
          {
            headers: {
              ...corsHeaders,
              'cache-control': 'public, max-age=3600',
            },
          },
        )
      },
    },
  },
})
