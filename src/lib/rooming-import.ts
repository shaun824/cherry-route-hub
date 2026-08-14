// Shared parsing for rooming lists: CSV text, Excel workbooks and Google Sheet
// rows all end up as the same ParsedRoomingRow shape.
import Papa from "papaparse";

export type ParsedRoomingRow = {
  full_name: string;
  email: string;
  tent_number: string;
  room_type: string;
  notes: string;
  location_hint: string;
  /** name of the drawn village-map area this person sits in (optional) */
  area: string;
};

export function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const hit = Object.keys(row).find((h) => h.trim().toLowerCase() === k.toLowerCase());
    if (hit && row[hit] != null && String(row[hit]).trim() !== "") return String(row[hit]).trim();
  }
  return "";
}

export function parseRoomingRecords(records: Record<string, unknown>[]): ParsedRoomingRow[] {
  return records
    .map((r) => ({
      full_name:
        pickField(r, ["full_name", "name", "Full Name", "Rider", "Guest"]) ||
        [pickField(r, ["First Name"]), pickField(r, ["Last Name"])].filter(Boolean).join(" "),
      email: pickField(r, ["email", "Email", "Email Address"]),
      tent_number: pickField(r, [
        "tent_number",
        "tent",
        "Tent Number",
        "Tent",
        "room",
        "Room",
        "room_number",
        "Room Number",
      ]),
      room_type: pickField(r, ["room_type", "Room Type", "Tent Type", "type", "Accommodation"]),
      notes: pickField(r, ["notes", "Notes", "Comment", "Comments"]),
      location_hint: pickField(r, ["location_hint", "location", "Location", "Where", "Block", "Row"]),
      area: pickField(r, ["area", "Area", "map_area", "Map Area", "zone", "Zone", "village_area"]),
    }))
    .filter((r) => r.full_name || r.email || r.tent_number);
}

export function parseRoomingCsv(text: string): ParsedRoomingRow[] {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  return parseRoomingRecords((res.data ?? []) as Record<string, unknown>[]);
}

/** Rows straight from the Sheets API (first row = headers) → records. */
export function rowsToRecords(values: unknown[][]): Record<string, unknown>[] {
  if (!values || values.length < 2) return [];
  const headers = (values[0] ?? []).map((h) => String(h ?? "").trim());
  return values.slice(1).map((row) => {
    const rec: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) rec[h] = row?.[i] ?? "";
    });
    return rec;
  });
}

/** Parses an .xlsx / .xls file in the browser (SheetJS is loaded on demand). */
export async function parseRoomingWorkbook(file: File): Promise<ParsedRoomingRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
  return parseRoomingRecords(json);
}

/** Normalises tent / area labels so "Tent 14", "tent-14" and "14" all match. */
export function normaliseLabel(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Loose match used to auto-place people on drawn village areas. */
export function labelsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normaliseLabel(a);
  const nb = normaliseLabel(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const numA = na.match(/\d+/)?.[0];
  const numB = nb.match(/\d+/)?.[0];
  const wordA = na.replace(/\d+/g, "").trim();
  const wordB = nb.replace(/\d+/g, "").trim();
  if (numA && numB && numA === numB && (!wordA || !wordB || wordA === wordB)) return true;
  return false;
}
