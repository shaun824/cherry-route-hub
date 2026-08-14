// Routine consistency audit of app content: events, days, routes, schedules,
// info blocks, rooming, entrants and sponsors. Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditIssue = {
  severity: "high" | "medium" | "low";
  area: string;
  eventId: string | null;
  eventName: string;
  message: string;
  fix?: string;
};

export type AuditSummary = {
  eventsChecked: number;
  issues: AuditIssue[];
  summary: string;
};

type Day = {
  id?: string;
  date?: string;
  label?: string;
  routes?: Array<{
    id?: string;
    name?: string;
    distanceKm?: number | null;
    elevationM?: number | null;
    kmlUrls?: string[];
  }>;
};

type ScheduleItem = { dayId?: string; time?: string; label?: string; details?: string };

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function minutes(time?: string): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function dayOnly(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

/** Run all deterministic content checks and return the issues found. */
export async function runContentAudit(admin: SupabaseClient): Promise<AuditSummary> {
  const issues: AuditIssue[] = [];
  const push = (i: AuditIssue) => issues.push(i);

  const { data: events, error } = await admin
    .from("events")
    .select(
      "id, name, slug, lifecycle, status, event_date, distance_km, location, days, schedule, logo_url, cover_url, title_sponsor_name, title_sponsor_logo_url, entry_ninja_id, entry_ninja_url, spectator_mode",
    )
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);

  const list = events ?? [];
  const now = new Date();

  const [{ data: infoBlocks }, { data: rooming }, { data: entrantRows }, { data: knowledge }] =
    await Promise.all([
      admin.from("event_info_blocks").select("event_id, venue_address, venue_lat, venue_lng, packing_list, route_description, faqs, emergency_contacts"),
      admin.from("event_rooming").select("event_id, entrant_id, full_name, tent_number"),
      admin.from("event_entrants").select("event_id, entrant_id, category, batch, tshirt_size, jacket_size"),
      admin.from("event_bot_knowledge").select("event_id, refreshed_at, last_error, content"),
    ]);

  const infoByEvent = new Map((infoBlocks ?? []).map((b: any) => [b.event_id, b]));
  const knowledgeByEvent = new Map((knowledge ?? []).map((k: any) => [k.event_id, k]));

  const countBy = <T,>(rows: T[] | null | undefined, key: (r: T) => string) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return m;
  };
  const roomingCount = countBy(rooming as any[], (r: any) => r.event_id);
  const entrantCount = countBy(entrantRows as any[], (r: any) => r.event_id);

  for (const ev of list) {
    const name = ev.name as string;
    const id = ev.id as string;
    const eventDate = ev.event_date ? new Date(ev.event_date as string) : null;
    const days = asArray<Day>(ev.days);
    const schedule = asArray<ScheduleItem>(ev.schedule);
    const isPast = eventDate ? eventDate.getTime() < now.getTime() - 24 * 3600 * 1000 : false;
    const upcomingSoon =
      eventDate && !isPast && eventDate.getTime() - now.getTime() < 45 * 24 * 3600 * 1000;

    // ---- lifecycle vs date
    if (isPast && ev.lifecycle === "published" && ev.status !== "completed" && ev.status !== "archived") {
      push({
        severity: "medium",
        area: "Lifecycle",
        eventId: id,
        eventName: name,
        message: `Event date has passed (${dayOnly(eventDate!)}) but it is still marked "${ev.status}".`,
        fix: "Archive or complete the event in Admin → Events.",
      });
    }

    // ---- day dates
    const dayDates = days.map((d) => d.date).filter(Boolean) as string[];
    if (eventDate && dayDates.length) {
      const first = [...dayDates].sort()[0];
      if (first !== dayOnly(eventDate)) {
        push({
          severity: "high",
          area: "Dates",
          eventId: id,
          eventName: name,
          message: `Event start date (${dayOnly(eventDate)}) does not match the first itinerary day (${first}).`,
          fix: "Align the event date with day 1 in Admin → Events.",
        });
      }
      // consecutive / duplicate day dates
      const sorted = [...dayDates].sort();
      const dupes = sorted.filter((d, i) => i > 0 && d === sorted[i - 1]);
      if (dupes.length) {
        push({
          severity: "medium",
          area: "Dates",
          eventId: id,
          eventName: name,
          message: `Duplicate itinerary day date(s): ${[...new Set(dupes)].join(", ")}.`,
        });
      }
    }
    for (const d of days) {
      if (!d.date) {
        push({
          severity: "medium",
          area: "Dates",
          eventId: id,
          eventName: name,
          message: `Itinerary day "${d.label ?? d.id ?? "?"}" has no date set.`,
        });
      }
    }

    // ---- distance consistency
    const routeDistances = days.flatMap((d) => (d.routes ?? []).map((r) => Number(r.distanceKm) || 0));
    const routeTotal = Math.round(routeDistances.reduce((a, b) => a + b, 0));
    if (routeTotal > 0 && Number(ev.distance_km) > 0) {
      const diff = Math.abs(routeTotal - Number(ev.distance_km));
      if (diff > Math.max(5, routeTotal * 0.08)) {
        push({
          severity: "high",
          area: "Routes",
          eventId: id,
          eventName: name,
          message: `Event total distance says ${ev.distance_km} km but the day routes add up to ${routeTotal} km.`,
          fix: "Update the event distance or the per-day route distances.",
        });
      }
    }
    for (const d of days) {
      for (const r of d.routes ?? []) {
        if (!r.distanceKm) {
          push({
            severity: "medium",
            area: "Routes",
            eventId: id,
            eventName: name,
            message: `Route "${r.name ?? r.id}" on ${d.label ?? d.date} has no distance.`,
          });
        }
        if (!(r.kmlUrls ?? []).length) {
          push({
            severity: "low",
            area: "Routes",
            eventId: id,
            eventName: name,
            message: `Route "${r.name ?? r.id}" on ${d.label ?? d.date} has no map file attached.`,
          });
        }
      }
    }

    // ---- schedule sanity
    const dayIds = new Set(days.map((d) => d.id).filter(Boolean) as string[]);
    const byDay = new Map<string, ScheduleItem[]>();
    for (const item of schedule) {
      const key = item.dayId ?? "";
      if (key && dayIds.size && !dayIds.has(key)) {
        push({
          severity: "high",
          area: "Schedule",
          eventId: id,
          eventName: name,
          message: `Schedule item "${item.label ?? item.time}" is attached to a day (${key}) that no longer exists.`,
          fix: "Reassign or delete the orphaned schedule item.",
        });
      }
      if (!minutes(item.time)) {
        push({
          severity: "medium",
          area: "Schedule",
          eventId: id,
          eventName: name,
          message: `Schedule item "${item.label ?? "(untitled)"}" has an invalid or missing time.`,
        });
      }
      byDay.set(key, [...(byDay.get(key) ?? []), item]);
    }
    for (const [dayId, items] of byDay) {
      const times = items.map((i) => minutes(i.time)).filter((n): n is number => n !== null);
      const outOfOrder = times.some((t, i) => i > 0 && t < times[i - 1]);
      const label = days.find((d) => d.id === dayId)?.label ?? dayId ?? "Unassigned";
      if (outOfOrder) {
        push({
          severity: "medium",
          area: "Schedule",
          eventId: id,
          eventName: name,
          message: `Times on "${label}" are not in chronological order.`,
          fix: "Reorder the itinerary items so riders read them in sequence.",
        });
      }
      // ride start mentioned but that day has no route
      const day = days.find((d) => d.id === dayId);
      const mentionsRide = items.some((i) => /ride (begins|starts)|race start|neutral start/i.test(i.label ?? ""));
      if (day && mentionsRide && !(day.routes ?? []).length) {
        push({
          severity: "high",
          area: "Schedule",
          eventId: id,
          eventName: name,
          message: `"${label}" has a ride start in the itinerary but no route loaded.`,
        });
      }
      if (day && (day.routes ?? []).length && !items.length) {
        push({
          severity: "medium",
          area: "Schedule",
          eventId: id,
          eventName: name,
          message: `"${label}" has a route but no itinerary times.`,
        });
      }
      // distance mentioned in details should match the route distance
      const routeKm = (day?.routes ?? [])[0]?.distanceKm;
      if (routeKm) {
        for (const i of items) {
          const m = /(\d{2,3}(?:[.,]\d)?)\s?km/i.exec(`${i.label ?? ""} ${i.details ?? ""}`);
          if (m) {
            const stated = Number(m[1].replace(",", "."));
            if (Math.abs(stated - Number(routeKm)) > 2) {
              push({
                severity: "high",
                area: "Schedule",
                eventId: id,
                eventName: name,
                message: `"${label}" itinerary mentions ${stated} km but the route file is ${routeKm} km.`,
                fix: "Update the itinerary wording to match the route.",
              });
            }
          }
        }
      }
    }

    // ---- info block
    const info: any = infoByEvent.get(id);
    if (!info) {
      if (upcomingSoon || !isPast) {
        push({
          severity: "medium",
          area: "Event info",
          eventId: id,
          eventName: name,
          message: "No event info block (venue, packing list, FAQs) has been created.",
          fix: "Add details in Admin → Event info.",
        });
      }
    } else {
      if (!info.venue_address) {
        push({ severity: "medium", area: "Event info", eventId: id, eventName: name, message: "Venue address is empty." });
      }
      if (info.venue_address && (info.venue_lat == null || info.venue_lng == null)) {
        push({
          severity: "low",
          area: "Event info",
          eventId: id,
          eventName: name,
          message: "Venue has an address but no map coordinates, so navigation links won't work.",
        });
      }
      const packing = asArray<unknown>(info.packing_list);
      const packingText = JSON.stringify(packing).toLowerCase();
      if (packingText.includes("tube")) {
        push({
          severity: "high",
          area: "Packing list",
          eventId: id,
          eventName: name,
          message: "Packing list still mentions tubes — riders are tubeless and should bring a spare tyre.",
        });
      }
      if (!asArray<unknown>(info.emergency_contacts).length && !isPast) {
        push({ severity: "medium", area: "Event info", eventId: id, eventName: name, message: "No emergency contacts listed." });
      }
    }

    // ---- branding & entries
    if (!ev.logo_url && !isPast) {
      push({ severity: "low", area: "Branding", eventId: id, eventName: name, message: "No event logo uploaded." });
    }
    if (ev.title_sponsor_name && !ev.title_sponsor_logo_url) {
      push({
        severity: "low",
        area: "Branding",
        eventId: id,
        eventName: name,
        message: `Title sponsor "${ev.title_sponsor_name}" has no logo.`,
      });
    }
    if (ev.status === "open" && !ev.entry_ninja_url) {
      push({
        severity: "high",
        area: "Entries",
        eventId: id,
        eventName: name,
        message: "Event is open for entry but has no Entry Ninja link.",
      });
    }

    // ---- rosters and rooming
    const entrants = entrantCount.get(id) ?? 0;
    const rooms = roomingCount.get(id) ?? 0;
    if (upcomingSoon && entrants === 0) {
      push({
        severity: "medium",
        area: "Roster",
        eventId: id,
        eventName: name,
        message: `Event is within 45 days but no entrants are loaded.`,
        fix: "Run an Entry Ninja sync or import the roster CSV.",
      });
    }
    if (rooms > 0 && entrants > 0 && rooms > entrants) {
      push({
        severity: "low",
        area: "Rooming",
        eventId: id,
        eventName: name,
        message: `Rooming list has ${rooms} people but only ${entrants} entrants are loaded.`,
      });
    }
    const unlinkedRooms = (rooming ?? []).filter((r: any) => r.event_id === id && !r.entrant_id).length;
    if (unlinkedRooms > 0) {
      push({
        severity: "medium",
        area: "Rooming",
        eventId: id,
        eventName: name,
        message: `${unlinkedRooms} rooming row(s) are not linked to an entrant, so those riders won't see their tent.`,
      });
    }

    // ---- bot knowledge freshness
    const know: any = knowledgeByEvent.get(id);
    if (!isPast) {
      if (!know || !know.content) {
        push({
          severity: "low",
          area: "Event bot",
          eventId: id,
          eventName: name,
          message: "The event bot has no knowledge loaded for this event.",
        });
      } else if (know.last_error) {
        push({
          severity: "medium",
          area: "Event bot",
          eventId: id,
          eventName: name,
          message: `Last bot knowledge refresh failed: ${String(know.last_error).slice(0, 140)}`,
        });
      } else if (know.refreshed_at && Date.now() - new Date(know.refreshed_at).getTime() > 30 * 24 * 3600 * 1000) {
        push({
          severity: "low",
          area: "Event bot",
          eventId: id,
          eventName: name,
          message: "Bot knowledge hasn't been refreshed in over 30 days.",
        });
      }
    }
  }

  // ---- cross-event checks
  const slugs = new Map<string, string>();
  for (const ev of list) {
    const slug = (ev.slug as string) ?? "";
    if (!slug) {
      push({ severity: "low", area: "Setup", eventId: ev.id as string, eventName: ev.name as string, message: "Event has no slug." });
      continue;
    }
    if (slugs.has(slug)) {
      push({
        severity: "high",
        area: "Setup",
        eventId: ev.id as string,
        eventName: ev.name as string,
        message: `Duplicate slug "${slug}" also used by ${slugs.get(slug)}.`,
      });
    }
    slugs.set(slug, ev.name as string);
  }

  const high = issues.filter((i) => i.severity === "high").length;
  const medium = issues.filter((i) => i.severity === "medium").length;
  const low = issues.length - high - medium;
  const summary = issues.length
    ? `${issues.length} issue(s) found across ${list.length} events — ${high} high, ${medium} medium, ${low} low.`
    : `All good: ${list.length} events checked, nothing inconsistent found.`;

  const order = { high: 0, medium: 1, low: 2 } as const;
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return { eventsChecked: list.length, issues, summary };
}

/** Run the audit and store the result. */
export async function runAndStoreContentAudit(admin: SupabaseClient) {
  try {
    const result = await runContentAudit(admin);
    const high = result.issues.filter((i) => i.severity === "high").length;
    await admin.from("content_audit_runs").insert({
      status: high > 0 ? "attention" : result.issues.length ? "warnings" : "ok",
      events_checked: result.eventsChecked,
      issue_count: result.issues.length,
      issues: result.issues,
      summary: result.summary,
    });
    return result;
  } catch (err) {
    const message = (err as Error).message;
    await admin.from("content_audit_runs").insert({
      status: "error",
      summary: "Audit failed to run.",
      error: message,
    });
    throw err;
  }
}
