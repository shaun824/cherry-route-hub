// Battery-saving upload cadence and hands-free tracking starts.
// Pure helpers so the rules can be tested without a phone.

/** Normal cadence while riding: one point every 10 seconds. */
export const MOVING_INTERVAL_MS = 10_000;
/** After 5 minutes standing still (water point, lunch) slow to once a minute. */
export const STATIONARY_INTERVAL_MS = 60_000;
export const STATIONARY_AFTER_MS = 5 * 60_000;
/** Movement smaller than this is GPS jitter, not riding. */
export const STATIONARY_RADIUS_M = 30;

export function uploadIntervalMs(lastMovedAt: number, now = Date.now()): number {
  return now - lastMovedAt >= STATIONARY_AFTER_MS ? STATIONARY_INTERVAL_MS : MOVING_INTERVAL_MS;
}

/** Auto-start on movement: over 10 km/h for 2 minutes straight. */
export const AUTO_START_KPH = 10;
export const AUTO_START_SUSTAIN_MS = 2 * 60_000;

export type SpeedSample = { at: number; kph: number | null };

/**
 * True when every sample in the last 2 minutes is above 10 km/h and the samples
 * actually cover the full 2 minutes (no gaps longer than 30 s).
 */
export function sustainedMovement(samples: SpeedSample[], now = Date.now()): boolean {
  const from = now - AUTO_START_SUSTAIN_MS;
  const recent = samples.filter((s) => s.at >= from - 30_000).sort((a, b) => a.at - b.at);
  if (recent.length < 3) return false;
  if (recent[0].at > from + 15_000) return false;
  for (let i = 0; i < recent.length; i++) {
    const s = recent[i];
    if (s.kph == null || s.kph <= AUTO_START_KPH) return false;
    const prev = i === 0 ? null : recent[i - 1];
    if (prev && s.at - prev.at > 30_000) return false;
  }
  return now - recent[recent.length - 1].at <= 30_000;
}

/** Geofence: the rider was inside the race village and has now left it. */
export function leftVillage(wasInside: boolean, distanceM: number | null, radiusM: number): boolean {
  return wasInside && distanceM !== null && distanceM > radiusM;
}

/** Start-batch reminder fires this long before the batch goes. */
export const BATCH_REMINDER_LEAD_MS = 15 * 60_000;

/** "HH:MM" on a SAST calendar day (YYYY-MM-DD) to epoch ms. */
export function sastTimeMs(day: string, hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(`${day}T${m[1].padStart(2, "0")}:${m[2]}:00+02:00`);
  return Number.isFinite(t) ? t : null;
}

/** Today's date in South Africa (YYYY-MM-DD). */
export function sastToday(now = Date.now()): string {
  return new Date(now + 2 * 3600_000).toISOString().slice(0, 10);
}

/** Batch start lookup by name (case-insensitive), ignoring batches with no time. */
export function batchStartTime(
  batches: { name: string; startTime?: string | null }[] | null | undefined,
  batch: string | null | undefined,
): string | null {
  if (!batch || !batches) return null;
  const want = batch.trim().toLowerCase();
  const hit = batches.find((b) => b.name.trim().toLowerCase() === want);
  return hit?.startTime?.trim() || null;
}
