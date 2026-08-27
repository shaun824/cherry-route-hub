import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The cell number on the signed-in rider's entry — used to remind them which
 * number partner offers (like the Cycle Lab R150) are linked to.
 * Returns null when signed out or when we have no number on file.
 */
export function useMyEntryPhone(): string | null {
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        const { data } = await supabase
          .from("entrants")
          .select("phone")
          .eq("user_id", uid)
          .not("phone", "is", null)
          .limit(1);
        const p = data?.[0]?.phone?.trim();
        if (!cancelled && p) setPhone(p);
      } catch {
        /* offline or signed out — the plain instruction still shows */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return phone;
}
