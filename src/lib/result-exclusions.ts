export type ResultExclusion = { name: string; bib: string | null; reason?: string };
const norm = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseResultExclusions(value: unknown): ResultExclusion[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ResultExclusion => !!item && typeof item === 'object' && typeof item.name === 'string' && (item.bib === null || typeof item.bib === 'string'));
}

export function isResultExcluded(rider: { full_name?: string; name?: string; bib_number?: string | null; bib?: string | null }, exclusions: ResultExclusion[]): boolean {
  const bib = norm(rider.bib_number ?? rider.bib);
  const name = norm(rider.full_name ?? rider.name);
  return exclusions.some(exclusion => bib && norm(exclusion.bib) ? bib === norm(exclusion.bib) : !!name && name === norm(exclusion.name));
}

export function excludeResultRows<T extends { full_name: string; bib_number: string | null; result_set_id: string; position: number | null }>(rows: T[], exclusions: ResultExclusion[]): T[] {
  const removed = rows.filter(row => isResultExcluded(row, exclusions));
  return rows.filter(row => !isResultExcluded(row, exclusions)).map(row => ({
    ...row,
    position: row.position === null ? null : row.position - removed.filter(other => other.result_set_id === row.result_set_id && other.position !== null && other.position < (row.position ?? 0)).length,
  }));
}