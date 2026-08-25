// Admin-only: who is signing in to the app.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";

export type SignInRow = {
  id: string;
  email: string | null;
  full_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  providers: string[];
  roles: string[];
};

export const listSignIns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignInRow[]> => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const users: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.listUsers>>["data"]["users"] = [];
    for (let page = 1; page <= 25; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const batch = data.users ?? [];
      users.push(...batch);
      if (batch.length < 1000) break;
    }

    const ids = users.map((u) => u.id);
    const roles: { user_id: string; role: string }[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      const slice = ids.slice(i, i + 500);
      const { data } = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", slice);
      roles.push(...((data ?? []) as { user_id: string; role: string }[]));
    }
    const nameById = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 500) {
      const slice = ids.slice(i, i + 500);
      const { data } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", slice);
      for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
        if (p.full_name) nameById.set(p.id, p.full_name);
      }
    }

    return users
      .map((u) => ({
        id: u.id,
        email: u.email ?? null,
        full_name:
          nameById.get(u.id) ??
          ((u.user_metadata?.full_name as string | undefined) ||
            (u.user_metadata?.name as string | undefined) ||
            ""),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        confirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
        providers: (u.app_metadata?.providers as string[] | undefined) ??
          (u.app_metadata?.provider ? [u.app_metadata.provider as string] : []),
        roles: roles.filter((r) => r.user_id === u.id).map((r) => r.role),
      }))
      .sort((a, b) => (b.last_sign_in_at ?? "").localeCompare(a.last_sign_in_at ?? ""));
  });
