type NativeWindow = { Capacitor?: { isNativePlatform?: () => boolean } };

export function isNativePlatform(): boolean {
  return typeof window !== "undefined" &&
    (window as unknown as NativeWindow).Capacitor?.isNativePlatform?.() === true;
}