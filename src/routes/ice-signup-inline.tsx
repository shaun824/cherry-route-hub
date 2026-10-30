import { createFileRoute, redirect } from '@tanstack/react-router';

// Alias kept for the ICE website embed, which iframes /ice-signup-inline.
export const Route = createFileRoute('/ice-signup-inline')({
  beforeLoad: () => {
    throw redirect({ to: '/ice-signup', replace: true });
  },
});
