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

export type NavigationEntry = {
  kind: "item";
  segment: string;
  title: string;
  icon?: NavigationIcon;
  onlyMobile?: boolean;
  activeMatch?: "exact" | "prefix";
  isActive?: (pathname: string) => boolean;
  visibility?: NavigationVisibility;
  children?: NavigationItem[];
};

export type NavigationItem =
  | NavigationEntry
  | { kind: "divider" }
  | {
      kind: "section";
      id: string;
      title?: string;
      collapsible?: boolean;
      defaultOpen?: boolean;
      visibility?: NavigationVisibility;
      children: NavigationItem[];
    }
  | {
      kind: "status";
      id: string;
      title: string;
      tone?: "muted" | "danger";
    };

export const navigationRowClassName =
  "flex h-10 min-h-10 items-center gap-3 w-full px-3 rounded-md text-left text-sm leading-ui transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus";

export const navigationSectionHeaderClassName =
  "flex h-10 min-h-10 items-center justify-start gap-2 w-full px-3 text-left text-xs font-medium uppercase leading-ui text-text-tertiary";
