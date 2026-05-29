// MainNavigation.tsx
//
// Single source for product navigation, grouped by user intent (discover /
// library / community / create / personal) plus signed-out auth entry points
// and an admin-only developer section. Visibility metadata classifies each
// entry; `NAVIGATION` filters by session state and flattens the visible groups
// into the `NavigationItem[]` the sidebar renders.

import {
  CircleUser as AccountCircleOutlinedIcon,
  FileText as ArticleOutlinedIcon,
  LayoutDashboard as DashboardOutlinedIcon,
  Files as DraftsOutlinedIcon,
  MessageCircleQuestion as FeedbackOutlinedIcon,
  Users as GroupsOutlinedIcon,
  Home as HomeOutlinedIcon,
  UserCheck as HowToRegOutlinedIcon,
  Inbox as InboxOutlinedIcon,
  ClipboardList as ListAltOutlinedIcon,
  LogIn as LoginOutlinedIcon,
  BookOpen as MenuBookOutlinedIcon,
  Bell as NotificationsOutlinedIcon,
  Palette as PaletteOutlinedIcon,
  ListPlus as PlaylistAddOutlinedIcon,
  FilePlus as PostAddOutlinedIcon,
  MessageSquareText as RateReviewOutlinedIcon,
  Search as SearchOutlinedIcon,
  Settings as SettingsOutlinedIcon,
  Headset as SupportAgentOutlinedIcon,
} from "lucide-react";
import type { NavigationItem, NavigationVisibility } from "./navigation";

export interface NavigationContext {
  /** A member session exists (signed in and registration complete enough). */
  isAuthenticated: boolean;
  /** Holds the ADMIN role; reveals the developer/diagnostics section. */
  isAdmin: boolean;
}

type NavigationEntry = Extract<NavigationItem, { kind: "item" }>;

interface NavigationGroup {
  title: string;
  visibility?: NavigationVisibility;
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

// Intent-grouped product navigation. Order within a group is intentional.
const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    title: "Discover",
    items: [
      { kind: "item", segment: "/", title: "Home", icon: HomeOutlinedIcon },
      {
        kind: "item",
        segment: "/search",
        title: "Search",
        icon: SearchOutlinedIcon,
        activeMatch: "prefix",
      },
      {
        kind: "item",
        segment: "/book",
        title: "Books",
        icon: MenuBookOutlinedIcon,
        activeMatch: "prefix",
      },
      {
        kind: "item",
        segment: "/realm",
        title: "Realms",
        icon: GroupsOutlinedIcon,
        activeMatch: "prefix",
      },
      {
        kind: "item",
        segment: "/review",
        title: "Reviews",
        icon: RateReviewOutlinedIcon,
        activeMatch: "prefix",
      },
      {
        kind: "item",
        segment: "/unit",
        title: "Units",
        icon: ArticleOutlinedIcon,
        activeMatch: "prefix",
      },
    ],
  },
  {
    title: "Library",
    items: [
      {
        kind: "item",
        segment: "/shelf",
        title: "Shelves",
        icon: ListAltOutlinedIcon,
        activeMatch: "prefix",
      },
    ],
  },
  {
    title: "Community",
    visibility: "authenticated",
    items: [
      {
        kind: "item",
        segment: "/inbox",
        title: "Inbox",
        icon: InboxOutlinedIcon,
        visibility: "authenticated",
        activeMatch: "prefix",
      },
      {
        kind: "item",
        segment: "/notice",
        title: "Notice",
        onlyMobile: true,
        icon: NotificationsOutlinedIcon,
        visibility: "authenticated",
      },
    ],
  },
  {
    title: "Create",
    visibility: "authenticated",
    items: [
      {
        kind: "item",
        segment: "/create",
        title: "Create",
        icon: PostAddOutlinedIcon,
        visibility: "authenticated",
      },
      {
        kind: "item",
        segment: "/book/new",
        title: "New Book",
        icon: PostAddOutlinedIcon,
        visibility: "authenticated",
      },
      {
        kind: "item",
        segment: "/shelf/new",
        title: "New Shelf",
        icon: PlaylistAddOutlinedIcon,
        visibility: "authenticated",
      },
    ],
  },
  {
    title: "Me",
    visibility: "authenticated",
    items: [
      {
        kind: "item",
        segment: "/u/me/dashboard",
        title: "Dashboard",
        icon: DashboardOutlinedIcon,
        visibility: "authenticated",
      },
      {
        kind: "item",
        segment: "/u/me/drafts",
        title: "Drafts",
        icon: DraftsOutlinedIcon,
        visibility: "authenticated",
      },
      {
        kind: "item",
        segment: "/user/me",
        title: "Profile",
        icon: AccountCircleOutlinedIcon,
        visibility: "authenticated",
      },
      {
        kind: "item",
        segment: "/user/me/setting",
        title: "Settings",
        icon: SettingsOutlinedIcon,
        visibility: "authenticated",
        activeMatch: "prefix",
      },
    ],
  },
  {
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

// Developer/diagnostics entries, revealed only for ADMIN accounts. These are
// not part of the product IA; staff operations live behind their own
// capability-gated routes, not here.
const ADMIN_GROUP: NavigationGroup = {
  title: "Developer",
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

/**
 * Build the visible navigation for the current session, grouped by intent.
 * Empty groups (after visibility filtering) are dropped; remaining groups get a
 * section header and are separated by dividers.
 */
export const NAVIGATION = (
  context: NavigationContext,
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
    if (index > 0) result.push({ kind: "divider" });
    result.push({ kind: "section", title: group.title });
    result.push(...group.items);
  });

  return result;
};
