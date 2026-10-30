/**
 * Where a signed-in account lands when it opens the app.
 *
 * Crew and admin accounts open on the crew centre. Tapping "Rider app" in the
 * crew bar sets a session flag so the rider home stays reachable for the rest
 * of that browser session; opening the app again (new session) goes back to the
 * crew centre.
 */

export const RIDER_APP_FLAG = "rce.rider-app";

export type CrewLandingInput = {
  signedIn: boolean;
  isCrew: boolean;
  wantsRiderApp: boolean;
};

/** "/crew" for crew/admin accounts that did not ask for the rider app, else "/". */
export function crewLandingTarget(input: CrewLandingInput): "/crew" | "/" {
  if (!input.signedIn) return "/";
  if (input.isCrew && !input.wantsRiderApp) return "/crew";
  return "/";
}

/** True when this browser session already chose the rider app. */
export function wantsRiderApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(RIDER_APP_FLAG) === "1";
  } catch {
    return false;
  }
}

/** Remember that this session asked for the rider app. */
export function markRiderAppVisit(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RIDER_APP_FLAG, "1");
  } catch {
    // Private mode / storage disabled: the rider home simply stays reachable
    // only until the next app open.
  }
}

/** Forget the choice so the next app open lands on the crew centre again. */
export function clearRiderAppVisit(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RIDER_APP_FLAG);
  } catch {
    // Nothing to clear.
  }
}
