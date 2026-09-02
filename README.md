# Cherry Rider Hub

Create a mobile-first web app for an event management company called "Red Cherry Events". The primary purpose of the app right now is to serve as a central information hub and communication forum for our event participants (riders). It needs to feel like a premium mobile app when opened on a smartphone. Please build the following core features: 1. A clean, modern home dashboard featuring the "Red Cherry Events" branding, displaying upcoming event dates and quick-link buttons. 2. An "Event Feed / News Forum" page where administrators can post updates, race notices, weather warnings, and general news. Riders should be able to scroll through these posts in a clean, chronological feed. 3. An "Event Info" section where riders can click on a specific event to see basic details (such as schedules, location maps, and general rider information). 4. A simple navigation bar at the bottom of the screen (e.g., Home, News Feed, Event Info) optimized for mobile thumb reach. Use a professional, clean aesthetic with a color palette that complements our event branding (incorporating a vibrant cherry red as an accent color against clean whites and dark grays). Make the layout highly scannable.

Note for architecture: Include fields to store external IDs so we can later integrate via API/webhooks with "Entry Ninja" to automatically pull user entry data into the app.

2. Event Management & Alerts:

Event Feed: A calendar or list view of upcoming events. Users should be able to click on an event to see details and click an "Enter/Join" button.

Comms Hub: A section for event-specific announcements, updates, and push notification alerts for new events.

3. Tracking & SOS (Safety Features):

A dedicated "Ride Tracker" page that utilizes the device's geolocation API.

A prominent, easily accessible red "SOS" button that, when triggered, captures the user's current GPS coordinates and sends an alert.

A map view where admins/users can see active riders during an event.

4. Media & Social Feed:

A "Highlights" or "Gallery" tab where videos and photos from the day's event can be posted. Design this similarly to a social media feed with cards containing media, captions, and the date.

5. Loyalty Program & Supplier Promos:

Loyalty Dashboard: A visual representation of a user's loyalty points or tier status (populated by their Entry Ninja event entries).

Promo Section: A dedicated space for "Supplier Promos" featuring discount codes, sponsor banners, and limited-time offers.

UI/UX & Technical Requirements:

Use Tailwind CSS for styling. Mobile-first design is critical since riders will use this on their phones.

Create a bottom navigation bar with icons for: Home (Feed/Promos), Events, Tracking (SOS), and Profile (Loyalty).

Provide a clean, high-contrast UI that is easy to read in bright sunlight.

Stub out the API integration points (like the Entry Ninja sync) with mock data for now, so I can see how the loyalty and user data will flow in the UI.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cherry-route-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bed1fb64-5051-4807-8a8e-23365ef16157).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
