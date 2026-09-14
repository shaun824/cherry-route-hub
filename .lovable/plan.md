# Swipeable Weekend Warrior route email

## What I’ll change
- Add the six supplied route profiles to the Weekend Warrior Lourensford route email: Gold, Silver, and Bronze for Day 1 and Day 2.
- Group each category into a two-slide Day 1 / Day 2 route viewer that riders can swipe horizontally on supported mobile email apps.
- Include clear Day 1 and Day 2 labels, dots, and a “Swipe for Day 2” cue so the interaction is obvious.
- Add an email-safe fallback that shows both days if an email app blocks interactive scrolling, ensuring no route is hidden.
- Update the mailer text with Day 2 distances and elevations and keep the tone informational rather than sales-focused.
- Send a fresh test email after publishing the updated workflow step.

## Technical details
- Store the uploaded profiles as hosted project assets so they load inside sent emails.
- Add a reusable route-pair block to the visual email block model, renderer, and builder controls.
- Render swipe behavior with email-safe HTML/CSS only; no JavaScript. Email apps vary, so unsupported clients will receive a readable stacked layout.
- Verify the email render, workflow data, test send, and current project build.
