import type React from "react";

export type NavigationIcon = React.ElementType<{
  className?: string;
  size?: string | number;
  color?: string;
}>;

/**
 * Controls which session states an entry (or section header) is shown for.
 * This is the navigation-side encoding of the route classification:
 * - `always`         → production routes available to everyone (discovery)
 * - `authenticated`  → personal/create/community routes for signed-in members
 * - `unauthenticated`→ auth entry points shown only while signed out
 *
 * Staff/operations routes are intentionally absent from product navigation and
 * gate themselves through governance capability hints at the route component.
 */
export type NavigationVisibility =
  | "always"
  | "authenticated"
  | "unauthenticated";

export type NavigationItem =
  | {
      kind: "item";
      segment: string;
      title: string;
      icon?: NavigationIcon;
      onlyMobile?: boolean;
      activeMatch?: "exact" | "prefix";
      isActive?: (pathname: string) => boolean;
      visibility?: NavigationVisibility;
      children?: NavigationItem[];
    }
  | { kind: "divider" }
  | { kind: "section"; title: string };
