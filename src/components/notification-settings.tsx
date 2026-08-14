import { useEffect, useState } from "react";

import { PushToggle } from "./push-optin";
import { getNotificationPreferences, saveNotificationPreferences } from "@/lib/push.functions";

/** Rider-facing notification controls (device toggle + category preferences). */
export function NotificationSettings() {
  const [prefs, setPrefs] = useState<{ news: boolean; event_reminders: boolean } | null>(null);

  useEffect(() => {
    void getNotificationPreferences()
      .then((p) => setPrefs({ news: p.news, event_reminders: p.event_reminders }))
      .catch(() => setPrefs({ news: true, event_reminders: true }));
  }, []);

  function update(patch: Partial<{ news: boolean; event_reminders: boolean }>) {
    setPrefs((p) => {
      const next = { ...(p ?? { news: true, event_reminders: true }), ...patch };
      void saveNotificationPreferences({ data: next }).catch(() => undefined);
      return next;
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="font-display text-base font-bold">Notifications</h2>
        <p className="text-xs text-ink-soft">
          Safety and race-day alerts are always sent — you can mute the rest.
        </p>
      </div>

      <PushToggle />

      <div className="space-y-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>News &amp; announcements</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[oklch(0.55_0.23_25)]"
            checked={prefs?.news ?? true}
            onChange={(e) => update({ news: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Event reminders (7 days &amp; 1 day before)</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[oklch(0.55_0.23_25)]"
            checked={prefs?.event_reminders ?? true}
            onChange={(e) => update({ event_reminders: e.target.checked })}
          />
        </label>
      </div>
    </section>
  );
}
