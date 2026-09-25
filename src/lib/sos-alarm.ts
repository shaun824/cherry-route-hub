// Audible + tab-level alarm for unacknowledged SOS alerts on the race-control
// screen. Uses the Web Audio API so there's no asset to load, and flashes the
// tab title so a controller notices even when the tab isn't focused.
import { useEffect, useRef } from "react";

class Alarm {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private urgent = false;

  private beep(freq: number, durationMs: number, gainValue: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    osc.connect(gain).connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    osc.start(now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.stop(now + durationMs / 1000);
  }

  private pattern() {
    const g = this.urgent ? 0.4 : 0.22;
    this.beep(880, 220, g);
    window.setTimeout(() => this.beep(1180, 220, g), 260);
    if (this.urgent) window.setTimeout(() => this.beep(1480, 260, g), 520);
  }

  isRunning() {
    return this.timer !== null;
  }

  start(urgent = false) {
    if (this.timer !== null) return;
    this.urgent = urgent;
    try {
      this.ctx = this.ctx ?? new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      void this.ctx.resume();
    } catch {
      return; // audio blocked — the visual takeover still fires
    }
    this.pattern();
    this.timer = window.setInterval(() => this.pattern(), urgent ? 1400 : 2600);
  }

  setUrgent(urgent: boolean) {
    if (urgent === this.urgent) return;
    const running = this.timer !== null;
    this.stop();
    if (running) this.start(urgent);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}

const alarm = new Alarm();

/**
 * Sounds the alarm and flashes the tab title while `active` is true.
 * `urgent` makes the alarm faster and louder (escalation).
 */
export function useSosAlarm(active: boolean, urgent = false, label = "SOS") {
  const originalTitle = useRef<string>("");

  useEffect(() => {
    if (!active) {
      alarm.stop();
      return;
    }
    alarm.start(urgent);
    originalTitle.current = originalTitle.current || document.title;
    let on = false;
    const id = window.setInterval(() => {
      on = !on;
      document.title = on ? `🚨 ${label}` : originalTitle.current;
    }, 800);
    return () => {
      window.clearInterval(id);
      alarm.stop();
      if (originalTitle.current) document.title = originalTitle.current;
    };
  }, [active, urgent, label]);

  useEffect(() => {
    if (active) alarm.setUrgent(urgent);
  }, [active, urgent]);
}

/** Lets a click anywhere unlock audio before the first alert arrives. */
export function primeAlarmAudio() {
  // Never touch a running alarm — a click must not silence an active SOS.
  if (alarm.isRunning()) return;
  alarm.start(false);
  alarm.stop();
}
