// Client-side route file builders: GPX/KML text from route lines, and the
// "download every route as GPX" zip used by race control.
import { parseKml, type LatLngAlt } from "@/lib/geo";
import type { EventDay } from "@/lib/mock-data";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildGpx(name: string, lines: LatLngAlt[][]): string {
  const segs = lines
    .map(
      (l) =>
        `<trkseg>${l
          .map(
            (c) =>
              `<trkpt lat="${c[1].toFixed(7)}" lon="${c[0].toFixed(7)}">${c[2] != null && c[2] > 0 ? `<ele>${(+c[2]).toFixed(1)}</ele>` : ""}</trkpt>`,
          )
          .join("")}</trkseg>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Red Cherry Rider Hub" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${esc(name)}</name></metadata><trk><name>${esc(name)}</name>${segs}</trk></gpx>\n`;
}

export function buildKml(name: string, lines: LatLngAlt[][]): string {
  const pm = lines
    .map(
      (l) =>
        `<Placemark><name>${esc(name)}</name><LineString><tessellate>1</tessellate><coordinates>${l
          .map((c) => `${c[0].toFixed(7)},${c[1].toFixed(7)},${(c[2] ?? 0).toFixed(1)}`)
          .join(" ")}</coordinates></LineString></Placemark>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(name)}</name>${pm}</Document></kml>\n`;
}

export async function fetchRouteLines(urls: string[]): Promise<LatLngAlt[][]> {
  const out: LatLngAlt[][] = [];
  for (const url of urls) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Route file failed to load (${res.status})`);
    out.push(...parseKml(await res.text()).lines);
  }
  return out;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Zips one GPX per route (all days) for an event. */
export async function buildAllRoutesGpxZip(eventName: string, days: EventDay[]): Promise<{ blob: Blob; count: number }> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  let count = 0;
  for (const [i, d] of days.entries()) {
    for (const r of d.routes ?? []) {
      if (!r.kmlUrls?.length) continue;
      const lines = await fetchRouteLines(r.kmlUrls);
      if (!lines.length) continue;
      const label = `${d.label || `Day ${i + 1}`} ${r.name}`;
      zip.file(`${String(++count).padStart(2, "0")}-${slug(label)}.gpx`, buildGpx(`${eventName} — ${label}`, lines));
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, count };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
