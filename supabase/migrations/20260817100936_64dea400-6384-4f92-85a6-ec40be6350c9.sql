
with e as (
  insert into public.entrants (full_name, email, phone, notes)
  values ('Mark Pretorius', 'mark.pretorius@mandg.co.za', '', 'M&G Investments — Marketing Manager (demo account)')
  on conflict do nothing
  returning id
), ent as (
  select id from e
  union all
  select id from public.entrants where email ilike 'mark.pretorius@mandg.co.za' limit 1
)
insert into public.event_entrants (event_id, entrant_id, category, bib_number, jacket_size, tshirt_size, extras, notes, paid, amount_due_cents, amount_paid_cents)
select v.event_id, (select id from ent limit 1), v.category, v.bib, 'L', 'L', v.extras::jsonb, v.notes, true, v.due, v.due
from (values
  ('003c81de-59a6-4165-9d41-9699fa0d4b32'::uuid, 'Single Luxury Tent Package (Solos)', 'MG01', '[{"name":"Event Jacket","qty":1,"size":"L"},{"name":"Tech T-Shirt","qty":1,"size":"L"},{"name":"Buff","qty":2},{"name":"Extra Dinner Ticket","qty":1}]', 'VIP guest — M&G Investments', 1790500),
  ('bc3de7b8-e278-47e9-b7e9-a63066cc4278'::uuid, 'Darlington Trip 1 | 22 - 25 April 2027', 'MG01', '[{"name":"Event Jacket","qty":1,"size":"L"},{"name":"Cap","qty":1},{"name":"Squirt Lube Pack","qty":1}]', 'VIP guest — M&G Investments', 1555000)
) as v(event_id, category, bib, extras, notes, due)
on conflict (event_id, entrant_id) do update set
  category = excluded.category,
  extras = excluded.extras,
  jacket_size = excluded.jacket_size,
  tshirt_size = excluded.tshirt_size,
  notes = excluded.notes,
  paid = excluded.paid,
  amount_due_cents = excluded.amount_due_cents,
  amount_paid_cents = excluded.amount_paid_cents;
