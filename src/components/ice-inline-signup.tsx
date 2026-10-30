import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { subscribeIceInterest } from '@/lib/ice-interest.functions';
import { iceInterestSchema } from '@/lib/ice-interest';

// Compact ICE sign-up for embedding on innercityenduro.co.za: name and email
// are on the page straight away, no button to click first.
export function IceInlineSignup() {
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

  return <div className="mx-auto w-full max-w-3xl px-5 py-6">
    {state === 'success' ? <p className="ice-inline-ok" role="status"><CheckCircle2 className="size-6 shrink-0" /> You're on the list. Your ICE guide is on its way, and we'll send the race-week email before the event.</p> : <form onSubmit={submit} className="ice-inline-form">
      <p className="ice-muted text-sm font-bold">28–29 NOVEMBER 2026 · BAAKENS VALLEY · GQEBERHA</p>
      <h2 className="ice-inline-title">Get the weekend guide</h2>
      <div className="ice-inline-row">
        <label className="ice-inline-field"><span className="sr-only">First name</span><input name="firstName" required maxLength={80} autoComplete="given-name" placeholder="First name" aria-label="First name" /></label>
        <label className="ice-inline-field ice-inline-field--wide"><span className="sr-only">Email address</span><input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="Email address" aria-label="Email address" /></label>
        <Button className="ice-submit ice-inline-submit h-12 px-6 text-base font-bold" type="submit" disabled={!ready || state === 'sending'}>{state === 'sending' ? 'Signing you up…' : 'Sign me up'}<ArrowRight /></Button>
      </div>
      <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      {error ? <p role="alert" className="ice-error pl-3 text-sm">{error}</p> : null}
      <label className="ice-muted flex items-start gap-3 text-sm leading-relaxed"><input name="consent" type="checkbox" required className="mt-1 size-4 shrink-0" /><span>Send me the ICE event guide, race-week email and Red Cherry Events motorbike news. I can unsubscribe at any time.</span></label>
    </form>}
  </div>;
}
