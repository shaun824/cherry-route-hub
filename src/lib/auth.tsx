// Session + role hooks used across the app.
import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { checkIsAdmin } from "./is-admin";

type SessionSnapshot = { session: Session | null; loading: boolean };

let sessionSnapshot: SessionSnapshot = { session: null, loading: true };
let sessionStarted = false;
const sessionListeners = new Set<() => void>();
const serverSessionSnapshot: SessionSnapshot = { session: null, loading: true };

function publishSession(session: Session | null) {
  sessionSnapshot = { session, loading: false };
  sessionListeners.forEach((listener) => listener());
}

function startSessionStore() {
  if (sessionStarted) return;
  sessionStarted = true;
  void supabase.auth.getSession().then(({ data }) => publishSession(data.session));
  supabase.auth.onAuthStateChange((_event, session) => publishSession(session));
}

function subscribeToSession(listener: () => void) {
  sessionListeners.add(listener);
  startSessionStore();
  return () => sessionListeners.delete(listener);
}

export function useSession() {
  const { session, loading } = useSyncExternalStore(
    subscribeToSession,
    () => sessionSnapshot,
    () => serverSessionSnapshot,
  );
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

/** Crew (event staff) access — admins count as crew too. */
export function useIsCrew() {
  const { user, loading } = useSession();
  const q = useQuery({
    queryKey: ["is-crew", user?.id ?? "anon"],
    queryFn: async () => {
      if (!user) return false;
      const { checkIsCrew } = await import("./crew");
      return await checkIsCrew(supabase as never);
    },
    enabled: !loading,
    staleTime: 60_000,
  });
  return { isCrew: Boolean(q.data), loading: loading || q.isLoading, user };
}

export async function signOut() {
  await supabase.auth.signOut();
}
