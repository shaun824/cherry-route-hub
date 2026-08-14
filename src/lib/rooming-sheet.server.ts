// Google Sheets → rooming list sync. The sheet is read through the Lovable
// connector gateway so no Google credentials live in the app.
import { parseRoomingRecords, rowsToRecords, type ParsedRoomingRow } from "@/lib/rooming-import";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export function spreadsheetIdFromUrl(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function connectorKey(): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  if (env['GOOGLE_SHEETS_API_KEY']) return env['GOOGLE_SHEETS_API_KEY'];
  const key = Object.keys(env).find((k) => k.startsWith("GOOGLE_SHEETS") && k.endsWith("API_KEY"));
  return key ? env[key] : undefined;
}

/** Reads a sheet range and returns rooming rows ready to import. */
export async function readSheetRooming(
  sheetUrl: string,
  range?: string | null,
): Promise<{ rows: ParsedRoomingRow[] }> {
  const id = spreadsheetIdFromUrl(sheetUrl);
  if (!id) throw new Error("That doesn't look like a Google Sheets link.");

  const lovableKey = process.env['LOVABLE_API_KEY'];
  const connKey = connectorKey();
  if (!lovableKey || !connKey) {
    throw new Error(
      "Google Sheets isn't connected yet — link the Google Sheets connection, then try again.",
    );
  }

  const a1 = (range ?? "").trim() || "A1:Z2000";
  const res = await fetch(`${GATEWAY_URL}/spreadsheets/${id}/values/${a1}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[rooming-sheet] gateway ${res.status}: ${body}`);
    throw new Error(`Google Sheets request failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { values?: unknown[][] };
  const records = rowsToRecords(json.values ?? []);
  return { rows: parseRoomingRecords(records) };
}
