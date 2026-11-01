import { Link, useRouter, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Back button that returns to the page the user actually came from.
 * Falls back to the given `to` only when there is no in-app history
 * (e.g. the page was opened directly from a link).
 */
type Props = LinkProps & {
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  children?: ReactNode;
};

export function BackLink(props: Props) {
  const router = useRouter();
  return (
    <Link
      {...(props as LinkProps)}
      className={props.className}
      style={props.style}
      aria-label={props["aria-label"]}
      onClick={(e) => {
        if (router.history.canGoBack()) {
          e.preventDefault();
          router.history.back();
        }
      }}
    >
      {props.children}
    </Link>
  );
}
