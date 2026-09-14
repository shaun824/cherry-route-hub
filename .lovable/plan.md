# Add the Weekend Warrior wheelie preloader

## What will change
- Convert the supplied standalone SVG/CSS/JavaScript animation into a reusable React loading screen.
- Show it as a full-screen cover during the app's initial startup, while the page prepares underneath.
- Remove the cover with a smooth fade only after both the page is ready and one complete 1.6-second animation has played.
- Keep normal in-app navigation fast rather than replaying the full loader on every tab change.
- Exclude clean embedded pages so website embeds continue loading without an app-branded overlay.
- Respect reduced-motion preferences and include an automatic timeout so a loading failure cannot leave someone trapped behind the animation.

## Visual treatment
- Preserve the supplied mountain line, moving cyclist, wheelie motion, wind lines, OTTO1890 label, and warm background.
- Adapt its colours to the app's existing design tokens while retaining the supplied Weekend Warrior appearance.
- Scale cleanly for phones, tablets, and desktop screens.

## Technical details
- Add one focused preloader component and its scoped styles.
- Mount it in the root app flow so it covers startup content without delaying network requests or page rendering.
- Use unique SVG identifiers to avoid conflicts if multiple instances ever render.
- Verify the startup animation, fade-out, underlying page visibility, embeds, and mobile sizing in the running preview.
