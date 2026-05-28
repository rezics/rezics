// NAVIGATION.tsx

import {
  CircleUser as AccountCircleOutlinedIcon,
  FileText as ArticleOutlinedIcon,
  LayoutDashboard as DashboardOutlinedIcon,
  MessageCircleQuestion as FeedbackOutlinedIcon,
  Users as GroupsOutlinedIcon,
  UserCheck as HowToRegOutlinedIcon,
  ClipboardList as ListAltOutlinedIcon,
  LogIn as LoginOutlinedIcon,
  UserCog as ManageAccountsOutlinedIcon,
  BookOpen as MenuBookOutlinedIcon,
  Bell as NotificationsOutlinedIcon,
  Palette as PaletteOutlinedIcon,
  ListPlus as PlaylistAddOutlinedIcon,
  FilePlus as PostAddOutlinedIcon,
  MessageSquareText as RateReviewOutlinedIcon,
  Headset as SupportAgentOutlinedIcon,
} from "lucide-react";
import type { NavigationItem } from "./navigation";

// segment: router path
export const NAVIGATION = (isAdmin = false): NavigationItem[] => {
  const common: NavigationItem[] = [
    {
      kind: "item",
      segment: "/",
      title: "Home",
      icon: DashboardOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/u/me/dashboard",
      title: "Dashboard",
      icon: DashboardOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/user/me",
      title: "My",
      onlyMobile: true,
      icon: AccountCircleOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/book",
      title: "Books",
      icon: MenuBookOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/shelf",
      title: "Shelves",
      icon: ListAltOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/review",
      title: "Reviews",
      icon: RateReviewOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/realm",
      title: "Realms",
      icon: GroupsOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/unit",
      title: "Units",
      icon: ArticleOutlinedIcon,
    },
    {
      kind: "item",
      segment: "/notice",
      title: "Notice",
      onlyMobile: true,
      icon: NotificationsOutlinedIcon,
    },

    { kind: "divider" },
    {
      kind: "item",
      segment: "/book/new",
      title: "New Book",
      icon: PostAddOutlinedIcon,
    },
    {
      kind: "item",
      title: "New Shelf",
      segment: "/shelf/new",
      icon: PlaylistAddOutlinedIcon,
    },
  ];

  const admin: NavigationItem[] = !isAdmin
    ? []
    : [
        { kind: "divider" },
        {
          kind: "item",
          segment: "/auth",
          title: "User",
          icon: ManageAccountsOutlinedIcon,
          children: [
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
          ],
        },

        { kind: "divider" },
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

        { kind: "divider" },
        {
          kind: "item",
          segment: "/theme-switch",
          title: "Theme Switch",
          icon: PaletteOutlinedIcon,
        },
      ];

  return [...common, ...admin];
};
