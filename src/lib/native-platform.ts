type NativeWindow = { Capacitor?: { isNativePlatform?: () => boolean }; navigator?: { standalone?: boolean }; matchMedia?: (query: string) => { matches: boolean } };

export function isNativePlatform(): boolean {
  return typeof window !== "undefined" &&
    (window as unknown as NativeWindow).Capacitor?.isNativePlatform?.() === true;
}

/** Store apps are installed even before native startup patches browser flags. */
export function isInstalledExperience(): boolean {
  if (typeof window === "undefined") return false;
  const appWindow = window as unknown as NativeWindow;
  return isNativePlatform() || appWindow.navigator?.standalone === true ||
    appWindow.matchMedia?.("(display-mode: standalone)").matches === true;
}