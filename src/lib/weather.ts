// Live weather for an event location, using the free Open-Meteo APIs (no key needed).

export type EventWeather = {
  place: string;
  current: {
    tempC: number;
    windKph: number;
    code: number;
  };
  daily: {
    date: string;
    maxC: number;
    minC: number;
    rainMm: number;
    rainChance: number;
    windKph: number;
    code: number;
  }[];
};

// Google Maps links often carry "@-33.96,25.61,15z" or "?q=-33.96,25.61".
export function parseCoords(input?: string | null): { lat: number; lng: number } | null {
  if (!input) return null;
  const m =
    input.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ??
    input.match(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

async function geocode(place: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const q = place.split(/[,|·]/)[0]?.trim() || place.trim();
  if (!q) return null;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q,
  )}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: { latitude: number; longitude: number; name: string; admin1?: string }[];
  };
  const hit = json.results?.[0];
  if (!hit) return null;
  return {
    lat: hit.latitude,
    lng: hit.longitude,
    label: [hit.name, hit.admin1].filter(Boolean).join(", "),
  };
}

export async function fetchEventWeather(opts: {
  location: string;
  mapQuery?: string | null;
}): Promise<EventWeather | null> {
  const coords = parseCoords(opts.mapQuery) ?? parseCoords(opts.location);
  let label = opts.location;
  let point = coords;
  if (!point) {
    const geo = await geocode(opts.location);
    if (!geo) return null;
    point = { lat: geo.lat, lng: geo.lng };
    label = geo.label;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lng}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as {
    current?: { temperature_2m: number; weather_code: number; wind_speed_10m: number };
    daily?: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
      precipitation_probability_max: (number | null)[];
      wind_speed_10m_max: number[];
    };
  };
  if (!j.current || !j.daily) return null;

  return {
    place: label,
    current: {
      tempC: Math.round(j.current.temperature_2m),
      windKph: Math.round(j.current.wind_speed_10m),
      code: j.current.weather_code,
    },
    daily: j.daily.time.map((date, i) => ({
      date,
      maxC: Math.round(j.daily!.temperature_2m_max[i] ?? 0),
      minC: Math.round(j.daily!.temperature_2m_min[i] ?? 0),
      rainMm: Math.round((j.daily!.precipitation_sum[i] ?? 0) * 10) / 10,
      rainChance: Math.round(j.daily!.precipitation_probability_max[i] ?? 0),
      windKph: Math.round(j.daily!.wind_speed_10m_max[i] ?? 0),
      code: j.daily!.weather_code[i] ?? 0,
    })),
  };
}

// WMO weather code → short label
export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Mixed";
}
