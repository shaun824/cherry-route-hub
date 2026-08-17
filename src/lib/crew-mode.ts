// Crew mode: once someone opens the crew dashboard, the app treats crew tools
// as their home base until they deliberately leave it.
import { useEffect, useState } from "react";

const KEY = "rce:crew-mode";

export function isCrewPath(pathname: string): boolean {
  return pathname.startsWith("/crew") && !pathname.startsWith("/crew/login");
}

export function setCrewModeStored(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) window.localStorage.setItem(KEY, "1");
  else window.localStorage.removeItem(KEY);
}

/** True when the user has entered crew tools this device (sticky across pages). */
export function useCrewMode(pathname: string) {
  const [crewMode, setCrewMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isCrewPath(pathname)) {
      setCrewModeStored(true);
      setCrewMode(true);
      return;
    }
    setCrewMode(window.localStorage.getItem(KEY) === "1");
  }, [pathname]);

  function exitCrewMode() {
    setCrewModeStored(false);
    setCrewMode(false);
  }

  return { crewMode, inCrewArea: isCrewPath(pathname), exitCrewMode };
}
