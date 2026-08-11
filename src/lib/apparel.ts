/** Events where riders do not receive an event T-shirt (jacket only). */
const NO_TSHIRT_MATCHES = ["addo"];

export function eventHasTshirt(eventName: string | null | undefined): boolean {
  const n = (eventName ?? "").toLowerCase();
  return !NO_TSHIRT_MATCHES.some((m) => n.includes(m));
}
