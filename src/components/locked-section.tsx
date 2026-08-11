// Shows content in a blurred, non-interactive state for signed-out visitors,
// with a sign-in overlay. Used across public event pages so riders can still
// see that the information exists.
import { Link, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";

export function LockedSection({
  locked,
  message = "Sign in to unlock this",
  children,
}: {
  locked: boolean;
  message?: string;
  children: React.ReactNode;
}) {
  const next = useRouterState({ select: (s) => s.location.href });
  if (!locked) return <>{children}</>;
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        aria-hidden
        className="pointer-events-none select-none blur-[5px] saturate-50 opacity-60"
      >
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-background/45 p-4 text-center backdrop-blur-[1px]">
        <div>
          <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-cherry/10">
            <Lock className="h-4 w-4 text-cherry" />
          </span>
          <p className="mt-2 max-w-[16rem] text-xs font-semibold text-ink">{message}</p>
          <Link
            to="/auth"
            search={{ next }}
            className="mt-2 inline-flex items-center rounded-xl cherry-gradient px-4 py-2 text-xs font-bold text-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
