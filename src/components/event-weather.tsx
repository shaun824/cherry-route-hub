import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Cloudy,
  Droplets,
  MapPin,
  Sun,
  Wind,
} from "lucide-react";
import { fetchEventWeather, weatherLabel } from "@/lib/weather";

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  const Icon =
    code === 0
      ? Sun
      : code <= 2
        ? Cloud
        : code === 3
          ? Cloudy
          : code === 45 || code === 48
            ? CloudFog
            : code >= 95
              ? CloudLightning
              : code >= 71 && code <= 86
                ? CloudSnow
                : code >= 51 && code <= 57
                  ? CloudDrizzle
                  : code >= 61
                    ? CloudRain
                    : Cloud;
  return <Icon className={className} />;
}

export function EventWeatherCard({
  eventName,
  location,
  mapQuery,
  eventDate,
}: {
  eventName: string;
  location: string;
  mapQuery?: string | null;
  eventDate?: string;
}) {
  const q = useQuery({
    queryKey: ["event-weather", location, mapQuery ?? ""],
    queryFn: () => fetchEventWeather({ location, mapQuery }),
    staleTime: 30 * 60_000,
    enabled: Boolean(location),
  });

  if (q.isLoading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-secondary" />;
  }
  const w = q.data;
  if (!w) return null;

  const [expanded, setExpanded] = useState(false);
  const raceDay = eventDate ? eventDate.slice(0, 10) : null;
  const days = w.daily.slice(0, 5);
  const raceForecast = raceDay ? w.daily.find((d) => d.date === raceDay) : undefined;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Weather at the venue
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm font-semibold text-ink">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-cherry" />
            <span className="truncate">{w.place}</span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{eventName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <WeatherIcon code={w.current.code} className="h-8 w-8 text-cherry" />
          <div className="text-right">
            <p className="font-display text-2xl font-black leading-none text-ink">
              {w.current.tempC}°
            </p>
            <p className="text-[11px] text-muted-foreground">{weatherLabel(w.current.code)}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-ink-soft">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1">
          <Wind className="h-3.5 w-3.5" /> {w.current.windKph} km/h
        </span>
        {raceForecast ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-cherry-deep">
            <Droplets className="h-3.5 w-3.5" /> Race day {raceForecast.minC}°–{raceForecast.maxC}° ·{" "}
            {raceForecast.rainChance}% rain
          </span>
        ) : null}
      </div>

      <ul className="mt-3 grid grid-cols-5 gap-1.5">
        {days.map((d) => {
          const isRace = raceDay === d.date;
          return (
            <li
              key={d.date}
              className={`rounded-xl px-1 py-2 text-center ring-1 ${
                isRace ? "bg-accent ring-cherry/40" : "bg-secondary/60 ring-transparent"
              }`}
            >
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                {new Date(`${d.date}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short" })}
              </p>
              <WeatherIcon code={d.code} className="mx-auto my-1 h-4 w-4 text-ink-soft" />
              <p className="text-[11px] font-bold text-ink">{d.maxC}°</p>
              <p className="text-[10px] text-muted-foreground">{d.minC}°</p>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-secondary/60 py-2 text-[11px] font-bold text-ink-soft transition active:scale-[0.99]"
      >
        {expanded ? (
          <>
            Show less <ChevronUp className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            10-day forecast <ChevronDown className="h-3.5 w-3.5" />
          </>
        )}
      </button>

      {expanded ? (
        <ul className="mt-2 space-y-1.5">
          {w.daily.map((d) => {
            const isRace = raceDay === d.date;
            const date = new Date(`${d.date}T12:00:00`);
            return (
              <li
                key={d.date}
                className={`rounded-xl px-3 py-2 ring-1 ${
                  isRace ? "bg-accent ring-cherry/40" : "bg-secondary/40 ring-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="w-16 shrink-0 text-[11px] font-bold text-ink">
                    {date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric" })}
                    {isRace ? <span className="ml-1 text-cherry">· Race</span> : null}
                  </p>
                  <WeatherIcon code={d.code} className="h-4 w-4 shrink-0 text-ink-soft" />
                  <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                    {weatherLabel(d.code)}
                  </p>
                  <p className="shrink-0 text-[11px] font-bold text-ink">
                    {d.maxC}° <span className="font-normal text-muted-foreground">/ {d.minC}°</span>
                  </p>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-ink-soft">
                  <span className="inline-flex items-center gap-1">
                    <Wind className="h-3 w-3" /> up to {d.windKph} km/h
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="h-3 w-3" /> {d.rainChance}% rain
                    {d.rainMm > 0 ? ` · ${d.rainMm} mm` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
