import { createFileRoute } from '@tanstack/react-router';
import { IceInlineSignup } from '@/components/ice-inline-signup';

export const Route = createFileRoute('/ice-signup-inline')({
  head: () => ({ meta: [
    { title: 'Inner City Enduro 2026 | Get the weekend guide' },
    { name: 'description', content: 'Add your name and email for the Inner City Enduro 2026 weekend guide and race-week email. 28–29 November, Baakens Valley, Gqeberha.' },
    { property: 'og:title', content: 'Inner City Enduro 2026 | Get the weekend guide' },
    { property: 'og:description', content: 'Sign up for the ICE 2026 weekend guide and race-week email.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: IceSignupInline,
});

function IceSignupInline() {
  return <main className="ice-signup ice-signup--compact"><IceInlineSignup /></main>;
}
