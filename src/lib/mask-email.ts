// Mask an email so a rider can recognise it without it being readable to others.
function maskPart(part: string): string {
  if (part.length <= 2) return part.charAt(0) + "•";
  return `${part.charAt(0)}${"•".repeat(Math.max(1, part.length - 2))}${part.charAt(part.length - 1)}`;
}

export function maskEmail(email: string): string {
  const clean = email.trim();
  const at = clean.lastIndexOf("@");
  if (at <= 0) return maskPart(clean);
  const local = clean.slice(0, at);
  const domain = clean.slice(at + 1);
  const dot = domain.indexOf(".");
  if (dot <= 0) return `${maskPart(local)}@${maskPart(domain)}`;
  const name = domain.slice(0, dot);
  const ext = domain.slice(dot); // includes leading dot, e.g. ".co.za"
  return `${maskPart(local)}@${maskPart(name)}${ext}`;
}
