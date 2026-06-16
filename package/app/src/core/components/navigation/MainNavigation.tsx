// MainNavigation.tsx
//
// Single source for product navigation. The main app sidebar intentionally
// stays compact: fixed app entries plus subscription-backed Zone and Realm groups.
// Existing routes such as search/reviews/shelves remain available from page
// affordances and direct URLs; they are simply not sidebar entry points.
// 产品导航的唯一来源。主应用侧边栏刻意保持精简：固定应用入口加上由订阅
// 驱动的 Zone 和 Realm 分组。诸如 search/reviews/shelves 等既有路由仍可通
// 过页面内的入口和直接 URL 访问；它们只是不作为侧边栏的入口。

import {
  Compass as CompassOutlinedIcon,
  MessageCircleQuestion as FeedbackOutlinedIcon,
  Users as GroupsOutlinedIcon,
  Home as HomeOutlinedIcon,
  UserCheck as HowToRegOutlinedIcon,
  LogIn as LoginOutlinedIcon,
  Palette as PaletteOutlinedIcon,
  Headset as SupportAgentOutlinedIcon,
} from "lucide-react";
import type {
  NavigationEntry,
  NavigationItem,
  NavigationVisibility,
} from "./navigation";

export interface NavigationContext {
  /** A member session exists (signed in and registration complete enough). 存在成员会话（已登录且注册完成度足够）。 */
  isAuthenticated: boolean;
  /** Holds the ADMIN role; reveals the developer/diagnostics section. 拥有 ADMIN 角色；显示开发者/诊断分区。 */
  isAdmin: boolean;
}

export interface MainSidebarSubscriptionItem {
  unitId: string;
  title: string;
  href: string;
  subscribedType?: "ZONE" | "REALM";
  pinned?: boolean;
  position?: string;
  state?: "ACTIVE" | "REMOVED";
  createdAt?: string | Date;
}

export interface NavigationBuildOptions {
  zones?: {
    items: MainSidebarSubscriptionItem[];
    isLoading?: boolean;
    errorMessage?: string | null;
  };
  realms?: {
    items: MainSidebarSubscriptionItem[];
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
    id: "home",
    items: [
      { kind: "item", segment: "/", title: "Home", icon: HomeOutlinedIcon },
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

function buildSubscriptionSection(input: {
  context: NavigationContext;
  sectionId: string;
  title: string;
  allTitle: string;
  allSegment: string;
  icon: NavigationEntry["icon"];
  entries?: {
    items: MainSidebarSubscriptionItem[];
    isLoading?: boolean;
    errorMessage?: string | null;
  };
  emptyTitle: string;
}): NavigationItem | null {
  if (!input.context.isAuthenticated) return null;

  const children: NavigationItem[] = [
    {
      kind: "item",
      segment: input.allSegment,
      title: input.allTitle,
      icon: input.icon,
      activeMatch: "exact",
    },
  ];

  if (input.entries?.isLoading) {
    children.push({
      kind: "status",
      id: `${input.sectionId}-loading`,
      title: `Loading ${input.title.toLowerCase()}...`,
    });
  } else if (input.entries?.errorMessage) {
    children.push({
      kind: "status",
      id: `${input.sectionId}-error`,
      title: input.entries.errorMessage,
      tone: "danger",
    });
  } else {
    const items = sortSidebarSubscriptionItems(input.entries?.items ?? []);
    if (items.length === 0) {
      children.push({
        kind: "status",
        id: `${input.sectionId}-empty`,
        title: input.emptyTitle,
      });
    } else {
      children.push(
        ...items.map(
          (item): NavigationEntry => ({
            kind: "item",
            segment: item.href,
            title: item.title,
            activeMatch: "prefix",
            subscriptionListEntry: item.subscribedType
              ? {
                  subscribedUnitId: item.unitId,
                  subscribedType: item.subscribedType,
                  pinned: item.pinned ?? false,
                  position: item.position ?? "",
                }
              : undefined,
          }),
        ),
      );
    }
  }

  return {
    kind: "section",
    id: input.sectionId,
    title: input.title,
    collapsible: true,
    defaultOpen: true,
    visibility: "authenticated",
    children,
  };
}

function sortSidebarSubscriptionItems(items: MainSidebarSubscriptionItem[]) {
  return items
    .filter((item) => item.state !== "REMOVED")
    .slice()
    .sort((a, b) => {
      const pinnedA = a.pinned ?? false;
      const pinnedB = b.pinned ?? false;
      if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;
      const position = (a.position ?? "").localeCompare(b.position ?? "");
      if (position !== 0) return position;
      const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdAtA - createdAtB;
    });
}

function buildRealmSection(
  context: NavigationContext,
  options: NavigationBuildOptions,
): NavigationItem | null {
  return buildSubscriptionSection({
    context,
    sectionId: "realms",
    title: "Realms",
    allTitle: "All Realms",
    allSegment: "/realm",
    icon: GroupsOutlinedIcon,
    entries: options.realms,
    emptyTitle: "No subscribed realms",
  });
}

function buildZoneSection(
  context: NavigationContext,
  options: NavigationBuildOptions,
): NavigationItem | null {
  return buildSubscriptionSection({
    context,
    sectionId: "zones",
    title: "Zones",
    allTitle: "All Zones",
    allSegment: "/z",
    icon: CompassOutlinedIcon,
    entries: options.zones,
    emptyTitle: "No subscribed zones",
  });
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
 * 为当前会话构建可见的导航。
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

  const zoneSection = buildZoneSection(context, options);
  if (zoneSection) result.push(zoneSection);

  const realmSection = buildRealmSection(context, options);
  if (realmSection) result.push(realmSection);

  return result;
};
