update public.event_info_blocks b
set venue_address = 'Nyathi Rest Camp, Kromriver, Addo Elephant National Park, Eastern Cape'
from public.events e
where e.id = b.event_id and e.name = 'Tour de Addo 2026 | Best of Nyathi';