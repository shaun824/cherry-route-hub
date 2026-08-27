import { sendTemplateEmail } from "../src/lib/email-templates/send-email";
import { loadPromoRows, offersForEvent } from "../src/lib/entry-welcome.server";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";

const id = "2dc4fd8c-c1f0-45b3-b5cd-61a3644f7fa7";
const { data } = await supabaseAdmin.from("events").select("id,name,event_date,location").eq("id", id).single();
const promos = await loadPromoRows(supabaseAdmin as any);
const offers = offersForEvent(promos, data!.name);
console.log("offers:", offers.map((o) => o.brand));
const r = await sendTemplateEmail("entry-welcome", "shaun@redcherryevents.co.za", {
  idempotencyKey: `entry-welcome-test-${Date.now()}`,
  templateData: {
    firstName: "Shaun",
    eventName: data!.name,
    eventDate: "Saturday, 17 October 2026",
    venue: data!.location ?? null,
    category: "Test entry",
    eventUrl: `https://riderapp.redcherryevents.co.za/my-events/${id}`,
    actionUrl: `https://riderapp.redcherryevents.co.za/my-events/${id}`,
    needsPassword: false,
    offers,
  },
});
console.log(r);
