import { getRequestHeader } from "@tanstack/react-start/server";

/** Atomic durable quotas, shared by all app instances, keyed independently of caller session IDs. */
export async function enforceRequestQuota(scope: string, limit: number, userId?: string | null) {
  const ip = getRequestHeader("cf-connecting-ip") ?? "unknown";
  const actor = userId ? `user:${userId}` : `ip:${ip}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(actor));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("consume_request_quota", { _scope: scope, _actor_hash: hash, _limit: limit, _window_seconds: 600 });
  if (error || data !== true) throw new Error("Too many requests. Please try again later.");
}