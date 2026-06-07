// MainNavigation.tsx
//
// Single source for product navigation. The main app sidebar intentionally
// stays compact: a primary unlabelled catalog group plus a Realms group.
// Existing routes such as search/reviews/shelves remain available from page
// affordances and direct URLs; they are simply not sidebar entry points.

import {
  MessageCircleQuestion as FeedbackOutlinedIcon,
  Gamepad2 as GamepadOutlinedIcon,
  Users as GroupsOutlinedIcon,
  Home as HomeOutlinedIcon,
  UserCheck as HowToRegOutlinedIcon,
  LogIn as LoginOutlinedIcon,
  BookOpen as MenuBookOutlinedIcon,
  Clapperboard as MovieOutlinedIcon,
  Palette as PaletteOutlinedIcon,
  Headset as SupportAgentOutlinedIcon,
} from "lucide-react";
import type {
  NavigationEntry,
  NavigationItem,
  NavigationVisibility,
} from "./navigation";

export interface NavigationContext {
  /** A member session exists (signed in and registration complete enough). */
  isAuthenticated: boolean;
  /** Holds the ADMIN role; reveals the developer/diagnostics section. */
  isAdmin: boolean;
}

export interface MainSidebarRealmItem {
  unitId: string;
  title: string;
  href: string;
}

export interface NavigationBuildOptions {
  realms?: {
    items: MainSidebarRealmItem[];
    isLoading?: boolean;
    errorMessage?: string | null;
  };
}

interface NavigationGroup {
  id: string;
  title?: string;
  visibility?: NavigationVisibility;
  collapsible?: boolean;
  defaultOpen?: boolean;
  items: NavigationEntry[];
}

function isVisible(
  visibility: NavigationVisibility | undefined,
  context: NavigationContext,
): boolean {
  switch (visibility) {
    case "authenticated":
      return context.isAuthenticated;
    case "unauthenticated":
      return !context.isAuthenticated;
    default:
      return true;
  }
}

const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    id: "primary",
    items: [
      { kind: "item", segment: "/", title: "Home", icon: HomeOutlinedIcon },
      {
        kind: "item",
        segment: "/book",
        title: "Books",
        icon: MenuBookOutlinedIcon,
        activeMatch: "prefix",
      },
      {
        kind: "item",
        segment: "/game",
        title: "Games",
        icon: GamepadOutlinedIcon,
        activeMatch: "prefix",
      },
      {
        kind: "item",
        segment: "/media",
        title: "Media",
        icon: MovieOutlinedIcon,
        activeMatch: "prefix",
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    visibility: "unauthenticated",
    items: [
      {
        kind: "item",
        segment: "/login",
        title: "Sign in",
        icon: LoginOutlinedIcon,
        visibility: "unauthenticated",
      },
      {
        kind: "item",
        segment: "/register",
        title: "Create account",
        icon: HowToRegOutlinedIcon,
        visibility: "unauthenticated",
      },
    ],
  },
];

function buildRealmSection(
  context: NavigationContext,
  options: NavigationBuildOptions,
): NavigationItem | null {
  if (!context.isAuthenticated) return null;

  const children: NavigationItem[] = [
    {
      kind: "item",
      segment: "/realm",
      title: "All Realms",
      icon: GroupsOutlinedIcon,
      activeMatch: "exact",
    },
  ];

  if (options.realms?.isLoading) {
    children.push({
      kind: "status",
      id: "realms-loading",
      title: "Loading realms...",
    });
  } else if (options.realms?.errorMessage) {
    children.push({
      kind: "status",
      id: "realms-error",
      title: options.realms.errorMessage,
      tone: "danger",
    });
  } else {
    const joinedRealms = options.realms?.items ?? [];
    if (joinedRealms.length === 0) {
      children.push({
        kind: "status",
        id: "realms-empty",
        title: "No joined realms",
      });
    } else {
      // Keep this as an ordinary scrollable list until measured sidebar
      // rendering shows 40px realm rows are a real bottleneck.
      children.push(
        ...joinedRealms.map(
          (realm): NavigationEntry => ({
            kind: "item",
            segment: realm.href,
            title: realm.title,
            activeMatch: "prefix",
          }),
        ),
      );
    }
  }

  return {
    kind: "section",
    id: "realms",
    title: "Realms",
    collapsible: true,
    defaultOpen: true,
    visibility: "authenticated",
    children,
  };
}

const ADMIN_GROUP: NavigationGroup = {
  id: "developer",
  title: "Developer",
  collapsible: true,
  defaultOpen: false,
  items: [
    {
      kind: "item",
      segment: "/login",
      title: "Login",
      icon: LoginOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/register",
      title: "Register",
      icon: HowToRegOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/feedback",
      title: "Feedback",
      icon: FeedbackOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/feedback/admin",
      title: "Feedback Admin",
      icon: SupportAgentOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/theme-switch",
      title: "Theme Switch",
      icon: PaletteOutlinedIcon,
    },
  ],
};

export const REMOVED_MAIN_SIDEBAR_SEGMENTS = [
  "/search",
  "/review",
  "/unit",
  "/shelf",
  "/create",
] as const;

/**
 * Build the visible navigation for the current session.
 */
export const NAVIGATION = (
  context: NavigationContext,
  options: NavigationBuildOptions = {},
): NavigationItem[] => {
  const groups = [...NAVIGATION_GROUPS];
  if (context.isAdmin) groups.push(ADMIN_GROUP);

  const visibleGroups = groups
    .filter((group) => isVisible(group.visibility, context))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isVisible(item.visibility, context)),
    }))
    .filter((group) => group.items.length > 0);

  const result: NavigationItem[] = [];
  visibleGroups.forEach((group, index) => {
    result.push({
      kind: "section",
      id: group.id,
      title: group.title,
      collapsible: group.collapsible,
      defaultOpen: group.defaultOpen,
      visibility: group.visibility,
      children: group.items,
    });
    if (index === 0) result.push({ kind: "divider" });
  });

  const realmSection = buildRealmSection(context, options);
  if (realmSection) result.push(realmSection);

  return result;
};
