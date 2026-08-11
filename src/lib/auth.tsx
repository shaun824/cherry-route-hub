// Session + role hooks used across the app.
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { checkIsAdmin } from "./is-admin";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, user: session?.user ?? null, loading };
}

export function useIsAdmin() {
  const { user, loading } = useSession();
  const q = useQuery({
    queryKey: ["is-admin", user?.id ?? "anon"],
    queryFn: async () => {
      if (!user) return false;
      return await checkIsAdmin(supabase as never);
    },
    enabled: !loading,
    staleTime: 60_000,
  });
  return {
    isAdmin: Boolean(q.data),
    loading: loading || q.isLoading,
    user,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}
