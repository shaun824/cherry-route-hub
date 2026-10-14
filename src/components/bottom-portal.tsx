// Renders bottom-pinned bars straight into <body>, so no page wrapper
// (transforms, filters, wide content, scroll containers) can drag a
// position:fixed bar up the page on iPhone Safari.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function BottomPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
