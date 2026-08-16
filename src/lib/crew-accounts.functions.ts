// Admin-only management of username-based crew logins (no email required).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";
import { crewEmailForUsername, isCrewEmail, normaliseCrewUsername, usernameFromCrewEmail } from "./crew-username";

const createSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(4).max(72),
  full_name: z.string().trim().max(120).optional().default(""),
});

const usernameSchema = z.object({ username: z.string().trim().min(3).max(40) });
const resetSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(4).max(72),
});

export const listCrewLogins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const crew = (data.users ?? []).filter((u) => isCrewEmail(u.email));
    const ids = crew.map((u) => u.id);
    const roles = ids.length
      ? (await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids)).data ?? []
      : [];
    return crew.map((u) => ({
      id: u.id,
      username: usernameFromCrewEmail(u.email ?? ""),
      full_name: (u.user_metadata?.full_name as string | undefined) ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      is_crew: roles.some((r) => r.user_id === u.id && r.role === "crew"),
    }));
  });

export const createCrewLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const username = normaliseCrewUsername(data.username);
    if (username.length < 3) throw new Error("Username must be at least 3 letters or numbers.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = crewEmailForUsername(username);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name || username, crew_username: username },
    });
    if (error) throw new Error(error.message.includes("already") ? "That username is taken." : error.message);

    const userId = created.user!.id;
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "crew" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
    return { ok: true as const, username, user_id: userId };
  });

export const resetCrewPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resetSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = crewEmailForUsername(data.username);
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) throw new Error("That crew login doesn't exist.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: data.password });
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteCrewLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => usernameSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = crewEmailForUsername(data.username);
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) return { ok: true as const };
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return { ok: true as const };
  });
