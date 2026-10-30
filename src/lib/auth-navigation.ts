/** Keep OAuth return destinations inside this app. */
export function safeAuthTarget(next?: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) return "/";
  return next;
}