// NAVIGATION.tsx

import type { NavigationItem } from "./navigation";
import { CircleUser as AccountCircleOutlinedIcon, FileText as ArticleOutlinedIcon, LayoutDashboard as DashboardOutlinedIcon, CircleAlert as ErrorOutlineOutlinedIcon, MessageCircleQuestion as FeedbackOutlinedIcon, Users as GroupsOutlinedIcon, UserCheck as HowToRegOutlinedIcon, ClipboardList as ListAltOutlinedIcon, LogIn as LoginOutlinedIcon, UserCog as ManageAccountsOutlinedIcon, BookOpen as MenuBookOutlinedIcon, Bell as NotificationsOutlinedIcon, Palette as PaletteOutlinedIcon, ListPlus as PlaylistAddOutlinedIcon, FilePlus as PostAddOutlinedIcon, MessageSquareText as RateReviewOutlinedIcon, FlaskConical as ScienceOutlinedIcon, Headset as SupportAgentOutlinedIcon } from "lucide-react";
import { IconNumber3 as Looks3OutlinedIcon, IconNumber1 as LooksOneOutlinedIcon, IconNumber2 as LooksTwoOutlinedIcon } from "@tabler/icons-react";

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
        {
          kind: "item",
          segment: "/test",
          title: "Test Suite",
          icon: ScienceOutlinedIcon,
          children: [
            {
              kind: "item",
              segment: "/test",
              title: "Test 01",
              icon: LooksOneOutlinedIcon,
            },
            {
              kind: "item",
              segment: "/test02",
              title: "Test 02",
              icon: LooksTwoOutlinedIcon,
            },
            {
              kind: "item",
              segment: "/test03",
              title: "Test 03",
              icon: Looks3OutlinedIcon,
            },
          ],
        },
        {
          kind: "item",
          segment: "/test/404",
          title: "404 Page",
          icon: ErrorOutlineOutlinedIcon,
        },
      ];

  return [...common, ...admin];
};
