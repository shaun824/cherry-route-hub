-- Categorise the existing reward catalogue and add lower-cost reward types.
UPDATE public.loyalty_rewards SET kind = 'merch' WHERE name = 'Free event jacket upgrade';
UPDATE public.loyalty_rewards SET kind = 'experience' WHERE name = 'Free tent upgrade night';

INSERT INTO public.loyalty_rewards (name, description, cost_points, value_label, terms, valid_days, active, sort_order, kind, stock, fulfilment_notes)
VALUES
  ('Red Cherry tech tee', 'Pick up a Red Cherry technical tee at registration.', 350, 'R450', 'Subject to size availability on the day.', 365, true, 10, 'merch', 60, 'Hand out at registration desk'),
  ('Red Cherry cap', 'Classic Red Cherry cap, collected at registration.', 180, 'R250', 'One per rider per event.', 365, true, 11, 'merch', 100, 'Hand out at registration desk'),
  ('Event buff + bottle combo', 'Branded buff and water bottle collected on event weekend.', 250, 'R320', 'While stocks last.', 365, true, 12, 'merch', 80, 'Hand out at registration desk'),
  ('Priority start batch', 'Move up to the batch ahead for one event.', 300, 'Priority', 'Subject to batch capacity, request 7 days before the event.', 365, true, 20, 'experience', 40, 'Confirm with timing team'),
  ('Early registration slot', 'Skip the queue with a first-hour registration slot.', 150, 'Fast track', 'One event per coupon.', 365, true, 21, 'experience', NULL, 'Registration desk'),
  ('Extra bag drop', 'One additional bag carried between stages.', 200, 'R300', 'Max 12kg, arrange at registration.', 365, true, 22, 'experience', 30, 'Logistics team'),
  ('Green Motion car hire 15% off', 'Partner discount on your travel to the event.', 100, '15% off', 'Use the Green Motion code shown in the app.', 365, true, 30, 'partner', NULL, 'Sponsor funded - no cost to us')
ON CONFLICT DO NOTHING;