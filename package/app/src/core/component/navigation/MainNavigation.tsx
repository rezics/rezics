// NAVIGATION.tsx

import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import Looks3OutlinedIcon from "@mui/icons-material/Looks3Outlined";
import LooksOneOutlinedIcon from "@mui/icons-material/LooksOneOutlined";
import LooksTwoOutlinedIcon from "@mui/icons-material/LooksTwoOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import PlaylistAddOutlinedIcon from "@mui/icons-material/PlaylistAddOutlined";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";

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
