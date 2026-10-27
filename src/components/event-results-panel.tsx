import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ExternalLink, RefreshCw, Search, Star, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PodiumSection } from '@/components/podium-section';
import { useSession } from '@/lib/auth';
import { getEventResults, getEventRiders, type ResultRow } from '@/lib/results.functions';
import { useRiderFavourites, matchesFav } from '@/lib/rider-favourites';
import { resultsForRider } from '@/lib/rider-result-matching';

export function EventResultsPanel({ eventId }: { eventId: string }) {
  const { user } = useSession();
  const loadResults = useServerFn(getEventResults);
  const loadRiders = useServerFn(getEventRiders);
  const resultsQ = useQuery({ queryKey: ['event-results', eventId], queryFn: () => loadResults({ data: { eventId } }), staleTime: 30_000, refetchInterval: q => q.state.data?.myriad_race_id ? 60_000 : false });
  const ridersQ = useQuery({ queryKey: ['event-riders', eventId, user?.id ?? 'guest'], queryFn: () => loadRiders({ data: { eventId } }), enabled: !!user, staleTime: 60_000 });
  const favs = useRiderFavourites(eventId);
  const [search, setSearch] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  const [category, setCategory] = useState('__all');
  const results = resultsQ.data;
  const sets = results?.sets ?? [];
  const setId = sets.some(set => set.id === selectedSet) ? selectedSet : sets[0]?.id;
  const rows = (results?.rows ?? []).filter(row => row.result_set_id === setId);
  const categories = [...new Set(rows.map(row => row.category).filter((value): value is string => !!value))].sort();
  const roster = ridersQ.data?.riders ?? [];
  const me = roster.find(rider => rider.is_me);
  const myRows = me ? resultsForRider(me, rows) : [];
  const myRow = myRows[0];
  const filtered = useMemo(() => rows.filter(row => (category === '__all' || row.category === category) && (!search.trim() || `${row.full_name} ${row.bib_number ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))), [rows, category, search]);
  const starred = filtered.filter(row => favs.list.some(fav => matchesFav(fav, row.full_name, row.bib_number)));

  const renderRow = (row: ResultRow, prefix: string) => {
    const rider = roster.find(candidate => resultsForRider(candidate, [row]).length > 0);
    const fav = favs.list.find(candidate => matchesFav(candidate, row.full_name, row.bib_number));
    const mine = me && rider?.id === me.id;
    return <li key={`${prefix}-${row.id}`} className={`flex items-center gap-3 border-b border-border py-3 last:border-0 ${mine ? 'bg-accent' : ''}`}>
      <span className="w-8 shrink-0 text-center font-mono text-sm font-semibold text-cherry">{row.position ?? '·'}</span>
      <div className="min-w-0 flex-1">
        {rider ? <Link to="/spectate/$eventId/rider/$entrantId" params={{ eventId, entrantId: rider.id }} className="block font-semibold text-ink">{row.full_name}{mine ? ' · You' : ''}</Link> : <p className="font-semibold text-ink">{row.full_name}</p>}
        <p className="text-xs text-ink-soft">{[row.bib_number ? `#${row.bib_number}` : null, row.category, rider?.age_band ? `Age ${rider.age_band}` : null, row.status].filter(Boolean).join(' · ')}</p>
      </div>
      <span className="shrink-0 font-mono text-xs font-semibold text-ink">{row.time_text ?? '·'}</span>
      {rider ? <Button variant="ghost" size="icon" aria-label={fav ? 'Remove from starred riders' : 'Star this rider'} aria-pressed={!!fav} onClick={() => favs.toggle(fav ?? { event_entrant_id: rider.id, full_name: rider.full_name, bib_number: rider.bib_number, category: rider.category })}><Star className={fav ? 'fill-cherry text-cherry' : 'text-ink-soft'} /></Button> : null}
    </li>;
  };

  return <section className="space-y-4" data-section="results">
    <header className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Trophy className="h-5 w-5 text-cherry" />Results</h2><Button variant="ghost" size="icon" aria-label="Refresh results" disabled={resultsQ.isFetching} onClick={() => void resultsQ.refetch()}><RefreshCw className={resultsQ.isFetching ? 'animate-spin' : ''} /></Button></header>
    <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"><Search className="h-4 w-4 shrink-0 text-ink-soft" /><input aria-label="Search results" placeholder="Name or race number" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" /></label>
    <details className="border-b border-border pb-3"><summary className="cursor-pointer text-sm font-semibold text-cherry">Weekend standings and podiums</summary><div className="mt-3"><PodiumSection eventId={eventId} /></div></details>
    {results?.results_url ? <Button asChild variant="outline" className="w-full"><a href={results.results_url} target="_blank" rel="noopener noreferrer">Official timing results<ExternalLink /></a></Button> : null}
    {resultsQ.isLoading ? <p className="text-sm text-ink-soft">Loading results…</p> : resultsQ.isError ? <p role="alert" className="text-sm text-destructive">Results could not load. Please try refresh.</p> : !results?.results_published || !sets.length ? <p className="py-4 text-sm text-ink-soft">Results have not been published yet.</p> : <>
      {results.feed_error ? <p className="text-xs text-ink-soft">The timing service is unavailable. Showing the last saved results.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-ink-soft">Day and course<select aria-label="Day and course" value={setId ?? ''} onChange={event => { setSelectedSet(event.target.value); setCategory('__all'); }} className="block w-full min-w-0 rounded-md border border-border bg-card p-2 text-sm text-ink">{sets.map(set => <option key={set.id} value={set.id}>{set.label}</option>)}</select></label>
        <label className="space-y-1 text-xs text-ink-soft">Category<select aria-label="Results category" value={category} onChange={event => setCategory(event.target.value)} className="block w-full rounded-md border border-border bg-card p-2 text-sm text-ink"><option value="__all">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      {myRow ? <div className="border-l-4 border-cherry bg-accent p-3"><p className="text-xs font-semibold text-cherry">Your result</p><p className="text-sm font-semibold text-ink">{myRow.full_name} · {myRow.position ? `#${myRow.position} · ` : ''}{myRow.time_text}</p></div> : null}
      {starred.length ? <section><h3 className="text-sm font-semibold text-ink">Starred riders</h3><ul>{starred.map(row => renderRow(row, 'starred'))}</ul></section> : null}
      <div><p className="mb-2 text-xs text-ink-soft">{filtered.length} results</p>{filtered.length ? <ol>{filtered.map(row => renderRow(row, 'all'))}</ol> : <p className="py-4 text-sm text-ink-soft">No results match that search.</p>}</div>
    </>}
  </section>;
}