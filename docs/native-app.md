# Rider Hub in the App Store and Google Play

This branch wraps the Rider Hub web app in [Capacitor](https://capacitorjs.com) so it can be published as a real iOS and Android app.

## How it works

- The store apps open **https://riderhub.redcherryevents.co.za** inside a native shell (`capacitor.config.ts`, `server.url`).
- **Everyday updates need no store release.** Publish in Lovable as usual and every installed app shows the new version the next time it opens.
- A new store build is only needed when something native changes: `ios/`, `android/`, `capacitor.config.ts`, the Capacitor plugins, permissions, the icon or the splash screen. That is the GitHub Action below.
- On the website nothing changes. All the native code sits behind `isNativeApp()` checks.

What the app adds over the website:

| Feature | Where |
| --- | --- |
| Live tracking keeps running with the screen locked (Android shows a "Rider Hub live tracking" notification) | `src/lib/native.ts`, which routes `navigator.geolocation` through `@capacitor-community/background-geolocation`. `tracker-panel.tsx` is unchanged. |
| Native push notifications on iPhone, without "Add to Home Screen" | `src/lib/native.ts` + `src/lib/push-client.ts` → `native-push.functions.ts` → `native-push.server.ts` (Firebase Cloud Messaging) |
| No "add to home screen" nags; the Android back button works | `src/lib/native.ts` |
| An offline screen if the app is opened with no signal | `native-shell/offline.html` |

## Files on this branch

```
capacitor.config.ts                 App id za.co.redcherryevents.riderhub, live URL, plugin settings
native-shell/                       Bundled fallback pages (no-signal screen)
ios/                                Xcode project (Swift Package Manager, no CocoaPods)
android/                            Android Studio / Gradle project
assets/                             Icon + splash source images (npm run cap:assets regenerates)
src/lib/native.ts                   Native bridge (no-op on the web)
src/lib/native-push.functions.ts    Saves/removes a phone's push token
src/lib/native-push.server.ts       Sends pushes via FCM HTTP v1 (WebCrypto, runs on Cloudflare)
native/sql/native_push_tokens.sql   Table for push tokens (apply once)
.github/workflows/native-apps.yml   Builds + uploads to TestFlight and Play internal testing
```

Changed Lovable files (small edits): `package.json` (Capacitor packages + `cap:*` scripts), `src/routes/__root.tsx` (one `useEffect` that starts the bridge in the app only), and `src/lib/push-client.ts` (in the app, push uses Firebase instead of Web Push).

## One-time setup

### 1. Accounts

- **Apple Developer Program**, enrolled as the organisation Red Cherry Events (needs a D-U-N-S number). Create the app in App Store Connect with bundle id `za.co.redcherryevents.riderhub`.
- **Google Play Console**, registered as an organisation (this skips the 12-tester / 14-day rule). Create the app with package name `za.co.redcherryevents.riderhub`.

### 2. Firebase (push notifications)

1. Create a Firebase project, then add an **iOS app** and an **Android app**, both with id `za.co.redcherryevents.riderhub`.
2. Download `GoogleService-Info.plist` (iOS) and `google-services.json` (Android).
3. In Apple Developer, create an **APNs Auth Key (.p8)** and upload it under Firebase → Project settings → Cloud Messaging → Apple app.
4. Firebase → Project settings → Service accounts → **Generate new private key**. This JSON is the server secret.

### 3. Database + server

- Ask Lovable: *"Run the SQL in native/sql/native_push_tokens.sql."*
- In Lovable, add the secret **`FIREBASE_SERVICE_ACCOUNT_JSON`** = the full service-account JSON from step 2.4.
- Ask Lovable to connect the send step (one small edit in `src/lib/notifications.server.ts`):

  > In dispatchNotification, after the Web Push loop and before the WhatsApp section, call `dispatchNativePush(admin, { userIds, kind, urgent, skip: input.skipPush, payload: { title: input.title, body: input.body, url: input.url || "/", imageUrl: input.imageUrl, urgent, notificationId, tag: input.dedupeKey || notificationId } })` from `./native-push.server`, and add its delivered/failed counts to the totals. Wrap it in try/catch so a Firebase error never blocks Web Push or WhatsApp.

### 4. Android upload key

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -i upload.jks | pbcopy   # copies it for the GitHub secret
```

Keep `upload.jks` and its passwords somewhere safe, such as a password manager. Turn on **Play App Signing** when you create the app (this is the default).

### 5. App Store Connect API key

App Store Connect → Users and Access → Integrations → **App Store Connect API** → create a key with the **Admin** role. CI uses it for automatic signing and uploads. Note the Key ID and Issuer ID, and download the `.p8`.

### 6. GitHub secrets

Repository → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `GOOGLE_SERVICES_JSON` | contents of `google-services.json` |
| `GOOGLE_SERVICE_INFO_PLIST` | contents of `GoogleService-Info.plist` |
| `ANDROID_KEYSTORE_BASE64` | base64 of `upload.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Cloud service account JSON with "Release manager" access in Play Console → Users and permissions |
| `APPLE_TEAM_ID` | 10-character Team ID (developer.apple.com → Membership) |
| `APP_STORE_CONNECT_KEY_ID` | API key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | API issuer ID |
| `APP_STORE_CONNECT_KEY_P8` | contents of the `.p8` file |

Until the secrets are added, the workflow still runs and checks that both projects compile.

## Shipping a build

1. GitHub → **Actions → Native apps → Run workflow**, or push a tag: `git tag app-v1.0.0 && git push origin app-v1.0.0`.
2. **iOS** goes to TestFlight. Add yourself and the crew as testers in App Store Connect, then submit for review when you're happy.
3. **Android** goes to the Play *internal testing* track. Leave **play_status = draft** until the app has passed its first review, then use `completed`.
4. Google only accepts API uploads after the app exists. Upload the very first `.aab` by hand: download it from the workflow run's artifacts and upload it in Play Console → Internal testing.

Build numbers come from the GitHub run number, so they always go up.

## Store review checklist

- **Privacy policy URL**, plus Apple "App Privacy" and Google "Data safety" answers: location (live tracking, SOS), name/email (account), push token. Location for minors: tracking is opt-in per session and stops automatically. Fix the public `tracking_points` read access from the readiness audit before submitting.
- **Google Play location declaration:** the app uses a *foreground service of type location* during live tracking. It does **not** request `ACCESS_BACKGROUND_LOCATION`. Play Console asks for a short video showing tracking start and stop.
- **Apple guideline 4.2 (minimum functionality):** mention background live tracking, SOS and native push in the review notes. Give the reviewer a demo login and an event with tracking switched on.
- **Screenshots:** iPhone 6.9" and Android phone. The app is iPhone-only for now (`TARGETED_DEVICE_FAMILY = 1`), so no iPad screenshots are needed.

## Running it locally (Mac)

```bash
npm install
cp ~/Downloads/GoogleService-Info.plist ios/App/App/
cp ~/Downloads/google-services.json android/app/
npx cap sync
npm run cap:ios       # opens Xcode → pick your team under Signing & Capabilities → Run
npm run cap:android   # opens Android Studio → Run
```

To test against the Lovable preview instead of the live site: `RIDER_HUB_URL=https://<preview-url> npx cap sync`.

## Known limits / next steps

- **App icon:** "Rider Hub" mark (logo panels + wordmark), sources in `assets/`. To change it, replace `assets/icon-only.png` (1024×1024, no transparency) and `icon-foreground.png` (artwork inside the centre ~62%), then run `npm run cap:assets`.
- **Android 5-minute throttle:** after about 5 minutes in the background, Android may slow WebView network calls. Points still queue on the phone (the tracker's offline queue) and upload in batches. If live positions lag on long rides, the next step is uploading points via `CapacitorHttp`.
- `@capacitor-community/background-geolocation` officially lists Capacitor 7. It builds fine with Capacitor 8 on Android (verified). Test iOS on a real device before release.
- **Offline:** the app needs signal the first time it opens. On Android the site's service worker and offline packs work as they do on the web. On iOS, service workers in an app's web view only work with *App-Bound Domains*, which is off for now because it would block the sign-in redirects. Enable it (`WKAppBoundDomains` in Info.plist + `limitsNavigationsToAppBoundDomains: true`) once the sign-in domains are confirmed, then test offline packs on an iPhone.
- **Lock files:** `bun.lock` / `package-lock.json` need refreshing for the new packages (`npm install` / `bun install`) before merging.
