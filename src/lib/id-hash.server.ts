// Server-only helper for hashing ID numbers with a project salt.
import { createHash } from "crypto";

export function hashIdNumber(idNumber: string): string {
  const salt = process.env.ID_HASH_SALT ?? "rce-static-fallback-salt-change-me";
  const clean = idNumber.replace(/\s+/g, "").toUpperCase();
  return createHash("sha256").update(`${salt}:${clean}`).digest("hex");
}

export function idNumberLast4(idNumber: string): string {
  const clean = idNumber.replace(/\s+/g, "");
  return clean.slice(-4);
}
