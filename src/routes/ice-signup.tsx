import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { subscribeIceInterest } from '@/lib/ice-interest.functions';
import { iceInterestSchema } from '@/lib/ice-interest';
import hero from '@/assets/ice/signup-hero.asset.json';

export const Route = createFileRoute('/ice-signup')({
  validateSearch: (search: Record<string, unknown>) => ({ compact: search.compact === '1' }),
  head: () => ({ meta: [
    { title: 'Inner City Enduro 2026 | Email sign-up' },
    { name: 'description', content: 'Get Inner City Enduro 2026 event details and the race-week guide. 28–29 November, Baakens Valley, Gqeberha.' },
    { property: 'og:title', content: 'Inner City Enduro 2026 | Email sign-up' },
    { property: 'og:description', content: 'Sign up for the ICE 2026 weekend guide and race-week email.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { property: 'og:image', content: hero.url },
    { name: 'twitter:image', content: hero.url },
  ] }),
  component: IceSignup,
});

function useSignup() {
  const subscribe = useServerFn(subscribeIceInterest);
  const [state, setState] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = iceInterestSchema.safeParse({ firstName: form.get('firstName'), email: form.get('email'), consent: form.get('consent') === 'on', website: form.get('website') || '' });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Please check your details.'); return; }
    setError(''); setState('sending');
    try { await subscribe({ data: parsed.data }); setState('success'); }
    catch { setError('We could not save your sign-up. Please try again.'); setState('idle'); }
  }
  return { state, error, ready, submit };
}

function ConsentLine() {
  return <label className="ice-muted flex items-start gap-3 text-sm leading-relaxed"><input name="consent" type="checkbox" required className="mt-1 size-4 shrink-0" /><span>Send me the ICE event guide, race-week email and Red Cherry Events motorbike news. I can unsubscribe at any time.</span></label>;
}

function Honeypot() {
  return <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>;
}

function IceSignup() {
  const { compact } = Route.useSearch();
  const { state, error, ready, submit } = useSignup();

  if (compact) {
    return <main className="ice-signup ice-signup--compact">
      <div className="mx-auto w-full max-w-3xl px-5 py-6">
        {state === 'success' ? <p className="ice-inline-ok" role="status"><CheckCircle2 className="size-6 shrink-0" /> You're on the list. Your ICE guide is on its way, and we'll send the race-week email before the event.</p> : <form onSubmit={submit} className="ice-inline-form">
          <p className="ice-muted text-sm font-bold">28–29 NOVEMBER 2026 · BAAKENS VALLEY · GQEBERHA</p>
          <h2 className="ice-inline-title">Get the weekend guide</h2>
          <div className="ice-inline-row">
            <label className="ice-inline-field"><span className="sr-only">First name</span><input name="firstName" required maxLength={80} autoComplete="given-name" placeholder="First name" aria-label="First name" /></label>
            <label className="ice-inline-field ice-inline-field--wide"><span className="sr-only">Email address</span><input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="Email address" aria-label="Email address" /></label>
            <Button className="ice-submit ice-inline-submit h-12 px-6 text-base font-bold" type="submit" disabled={!ready || state === 'sending'}>{state === 'sending' ? 'Signing you up…' : 'Sign me up'}<ArrowRight /></Button>
          </div>
          <Honeypot />
          {error ? <p role="alert" className="ice-error pl-3 text-sm">{error}</p> : null}
          <ConsentLine />
        </form>}
      </div>
    </main>;
  }

  return <main className="ice-signup h-dvh overflow-y-auto">
    <img src={hero.url} alt="Inner City Enduro riders on the start line" className="ice-signup-photo" />
    <div className="mx-auto max-w-xl px-6 py-7">
      <p className="ice-muted text-sm font-bold">28–29 NOVEMBER 2026 · BAAKENS VALLEY</p>
      <h1 className="mt-3 text-4xl leading-tight">Inner City Enduro</h1>
      {state === 'success' ? <section role="status" className="mt-6 py-4"><CheckCircle2 className="size-8" /><h2 className="mt-4 text-3xl">You're on the list.</h2><p className="mt-3">Thanks for signing up. Your ICE guide is on its way, and we'll send the race-week email before the event.</p><a className="mt-5 inline-block underline" href="https://innercityenduro.co.za/" target="_blank" rel="noopener">Back to Inner City Enduro</a></section> : <form onSubmit={submit} className="mt-6 space-y-4 pt-5">
        <h2 className="text-3xl">Get the weekend guide</h2>
        <div><label htmlFor="ice-firstName" className="mb-2 block text-sm font-bold">First name</label><input id="ice-firstName" name="firstName" required maxLength={80} autoComplete="given-name" className="h-12 w-full rounded border px-3" /></div>
        <div><label htmlFor="ice-email" className="mb-2 block text-sm font-bold">Email address</label><input id="ice-email" name="email" type="email" required maxLength={254} autoComplete="email" className="h-12 w-full rounded border px-3" /></div>
        <Honeypot />
        <ConsentLine />
        {error ? <p role="alert" className="ice-error pl-3 text-sm">{error}</p> : null}
        <Button className="ice-submit h-12 w-full text-base font-bold" type="submit" disabled={!ready || state === 'sending'}>{state === 'sending' ? 'Signing you up…' : 'Sign me up'}<ArrowRight /></Button>
      </form>}
      <footer className="ice-muted mt-6 text-xs"><a href="/policy" target="_blank" rel="noopener" className="underline">Privacy policy</a> · Red Cherry Events</footer>
    </div>
  </main>;
}
