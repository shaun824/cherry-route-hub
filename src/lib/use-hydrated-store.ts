// Hook that rehydrates zustand persist storage on client only, then returns
// whether hydration has finished. Renders seed data during SSR / before
// hydration to avoid SSR/CSR mismatches.
import { useEffect, useState } from "react";
import { useAdminStore } from "./store";

let started = false;

export function useHydratedStore() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (started) {
      setHydrated(true);
      return;
    }
    started = true;
    useAdminStore.persist.rehydrate()?.then(() => setHydrated(true));
    // If rehydrate returned void (already hydrated), still flip flag.
    setHydrated(true);
  }, []);
  return hydrated;
}
