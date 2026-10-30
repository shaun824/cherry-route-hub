import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native (App Store / Google Play) wrapper for the Rider Hub.
 *
 * The app loads the live site, so every Lovable publish reaches the store apps
 * straight away (no store review). A new store build is only needed when
 * native code, plugins, permissions, icons or this file change.
 *
 * `native-shell/` is bundled inside the app and is only shown when the phone
 * has no signal on first launch.
 */
const LIVE_URL = process.env.RIDER_HUB_URL ?? "https://riderhub.redcherryevents.co.za";

const config: CapacitorConfig = {
  appId: "za.co.redcherryevents.riderhub",
  appName: "Rider Hub",
  webDir: "native-shell",
  server: {
    url: LIVE_URL,
    cleartext: false,
    errorPath: "offline.html",
    // Sign-in, Entry Ninja, maps and payment links stay inside the app.
    allowNavigation: [
      "riderhub.redcherryevents.co.za",
      "riderapp.redcherryevents.co.za",
      "*.redcherryevents.co.za",
      "*.supabase.co",
      "*.lovable.app",
      "*.lovable.dev",
    ],
  },
  ios: {
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: "#ffffff",
  },
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
    // Keeps background GPS updates flowing past 5 minutes with the screen locked
    // (see @capacitor-community/background-geolocation README).
    useLegacyBridge: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  experimental: {
    ios: {
      spm: {
        // Avoids a SwiftPM package identity clash with the Firebase SDK.
        packageOptions: {
          "@capacitor-firebase/messaging": { symlink: true },
        },
      },
    },
  },
};

export default config;
