// Store-app (iOS / Android) push tokens. The website keeps using Web Push via
// push.functions.ts; these are only called from src/lib/native.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveNativePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(20).max(4096),
        platform: z.enum(["ios", "android"]),
        userAgent: z.string().max(400).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { error } = await admin.from("native_push_tokens").upsert(
      {
        user_id: context.userId,
        token: data.token,
        platform: data.platform,
        user_agent: data.userAgent ?? null,
        failure_count: 0,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw error;

    await admin
      .from("notification_preferences")
      .upsert({ user_id: context.userId }, { onConflict: "user_id", ignoreDuplicates: true });

    return { ok: true as const };
  });

export const removeNativePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ token: z.string().max(4096) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    await admin.from("native_push_tokens").delete().eq("token", data.token).eq("user_id", context.userId);
    return { ok: true as const };
  });
