import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import trails from '@/assets/ww-email/ww-trails.jpg.asset.json';
import logo from '@/assets/ww-email/ww_logo_red_cherry_events.png.asset.json';

export const Route = createFileRoute('/otto1890-signup')({
  head: () => ({ meta: [
    { title: 'Otto1890 Weekend Warrior 2027 — Entry alerts' },
    { name: 'description', content: 'Sign up for Otto1890 Weekend Warrior 2027 entry alerts. Oak Valley 2–4 April and Lourensford 8–10 October. Entries open 1 December at 09:00 SAST.' },
    { property: 'og:title', content: 'Otto1890 Weekend Warrior 2027 — Entry alerts' },
    { property: 'og:description', content: 'Two unforgettable weekends. Get the entry-opening reminder for Oak Valley and Lourensford.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: SignupPage,
});

function SignupPage() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setState('sending');
    try {
      const response = await fetch('/api/public/entry-interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, website }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Please try again.');
      setState('success');
    } catch (cause) { setState('idle'); setError(cause instanceof Error ? cause.message : 'Please try again.'); }
  }
  return <main className="ww-signup h-dvh overflow-y-auto">
    <header className="ww-signup-photo relative">
      <img src={trails.url} alt="Otto1890 Weekend Warrior riders on the trails" className="absolute inset-0 h-full w-full object-cover" />
      <div className="ww-signup-shade absolute inset-0" />
      <div className="relative mx-auto max-w-2xl px-6 py-12 sm:px-10 sm:py-16">
        <p className="mb-5 text-xs font-bold tracking-widest">RED CHERRY EVENTS · 2027</p>
        <h1 className="ww-signup-heading max-w-lg text-4xl leading-tight sm:text-5xl">Otto1890<br />Weekend Warrior</h1>
        <p className="mt-5 text-lg">Two weekends. One incredible adventure.</p>
      </div>
    </header>
    <section className="mx-auto max-w-2xl px-6 py-8 sm:px-10">
      <p className="ww-signup-label text-xs font-bold tracking-widest">ENTRIES OPEN 1 DECEMBER · 09:00 SAST</p>
      <div className="my-6 grid gap-4 sm:grid-cols-2">
        <div className="border-b border-current/20 pb-4"><h2 className="ww-signup-heading text-2xl">Oak Valley</h2><p className="mt-2 flex items-center gap-2 text-sm"><CalendarDays className="size-4" />2–4 April 2027</p></div>
        <div className="border-b border-current/20 pb-4"><h2 className="ww-signup-heading text-2xl">Lourensford</h2><p className="mt-2 flex items-center gap-2 text-sm"><CalendarDays className="size-4" />8–10 October 2027</p></div>
      </div>
      {state === 'success' ? <div role="status" className="py-4"><CheckCircle2 className="mb-3 size-8" /><h2 className="ww-signup-heading text-3xl">You're on the list!</h2><p className="mt-3">Check your inbox for the 2027 dates. We'll remind you when entries open.</p></div> : <form onSubmit={submit} className="space-y-4">
        <h2 className="ww-signup-heading text-3xl">Be first on the start line.</h2>
        <label htmlFor="signup-email" className="block text-sm font-semibold">Email address</label>
        <input id="signup-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="ww-signup-input h-12 w-full rounded border px-4" />
        <div className="hidden" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></div>
        <p className="text-xs leading-relaxed">By signing up, you agree to receive Otto1890 Weekend Warrior entry alerts and Red Cherry Events bicycle-event news. You can unsubscribe at any time.</p>
        {error ? <p role="alert" className="text-sm font-semibold">{error}</p> : null}
        <Button type="submit" size="lg" className="ww-signup-submit h-12 w-full" disabled={state === 'sending'}>{state === 'sending' ? 'Signing you up…' : 'Notify me'}<ArrowRight /></Button>
      </form>}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-current/20 pt-6"><img src={logo.url} alt="Red Cherry Events" className="ww-signup-logo h-14 w-36 object-contain p-2" /><Link to="/policy" className="text-xs underline">Privacy policy</Link></footer>
    </section>
  </main>;
}