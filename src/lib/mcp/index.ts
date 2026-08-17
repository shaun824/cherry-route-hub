import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEvents from "./tools/list-events";
import getEvent from "./tools/get-event";
import listMyEntries from "./tools/list-my-entries";
import listNews from "./tools/list-news";
import getEventResults from "./tools/get-event-results";
import getMyLoyalty from "./tools/get-my-loyalty";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "cherry-rider-hub",
  title: "Cherry Rider Hub",
  version: "0.1.0",
  instructions:
    "Tools for the Red Cherry Events Rider Hub. Use `list_events` and `get_event` for event dates, schedules, venues and packing lists; `list_my_entries` and `get_my_loyalty` for the signed-in rider's own entries and Cherry Miles; `get_event_results` for published results; `list_news` for rider news.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listEvents, getEvent, listMyEntries, getMyLoyalty, getEventResults, listNews],
});
