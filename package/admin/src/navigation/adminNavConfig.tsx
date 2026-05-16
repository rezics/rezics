import type React from "react";
import {
  ShieldUser as AdminPanelSettingsOutlinedIcon,
  BookMarked as CollectionsBookmarkIcon,
  LayoutDashboard as DashboardIcon,
  Mail as EmailOutlinedIcon,
  MessagesSquare as ForumIcon,
  IdCard as IdentityIcon,
  Package as Inventory2Icon,
  Key as KeyOutlinedIcon,
  SearchCheck as ManageSearchOutlinedIcon,
  Users as PeopleIcon,
  Settings as SettingsIcon,
  Database as StorageOutlinedIcon,
  Tags as StyleOutlinedIcon,
  KeyRound as VpnKeyOutlinedIcon,
} from "lucide-react";

export type AdminNavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  to: string;
  requiredRole?: "owner";
};

export type AdminNavGroup = {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: AdminNavItem[];
};

export type AdminNavEntry = AdminNavItem | AdminNavGroup;

export const adminNav = {
  drawerWidth: 260,
  items: [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <DashboardIcon fontSize="small" />,
      to: "/",
    },
    {
      id: "user",
      label: "Users",
      icon: <PeopleIcon fontSize="small" />,
      children: [
        {
          id: "user.list",
          label: "List",
          icon: <PeopleIcon fontSize="small" />,
          to: "/user",
        },
        {
          id: "user.meili",
          label: "Meili Search",
          icon: <PeopleIcon fontSize="small" />,
          to: "/user/meili",
        },
        {
          id: "user.create",
          label: "Create",
          icon: <PeopleIcon fontSize="small" />,
          to: "/user/create",
        },
      ],
    },
    {
      id: "unit",
      label: "Units",
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: "unit.list",
          label: "List",
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit",
        },
        {
          id: "unit.meili",
          label: "Meili Search",
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit/meili",
        },
        {
          id: "unit.create",
          label: "Create",
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit/create",
        },
      ],
    },
    {
      id: "book",
      label: "Books",
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: "book.list",
          label: "List",
          icon: <Inventory2Icon fontSize="small" />,
          to: "/book",
        },
        {
          id: "book.meili",
          label: "Meili Search",
          icon: <Inventory2Icon fontSize="small" />,
          to: "/book/meili",
        },
      ],
    },
    {
      id: "entities",
      label: "Entities",
      icon: <IdentityIcon fontSize="small" />,
      to: "/entities",
    },
    // MOCK: realm management pages not yet implemented
    {
      id: "realm",
      label: "Realms",
      icon: <ForumIcon fontSize="small" />,
      children: [
        {
          id: "realm.list",
          label: "List",
          icon: <ForumIcon fontSize="small" />,
          to: "/realm",
        },
      ],
    },
    {
      id: "tag",
      label: "Tags",
      icon: <StyleOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "tag.low-score",
          label: "Low-score",
          icon: <StyleOutlinedIcon fontSize="small" />,
          to: "/tag/low-score",
        },
      ],
    },
    // MOCK: shelf management pages not yet implemented
    {
      id: "shelf",
      label: "Shelves",
      icon: <CollectionsBookmarkIcon fontSize="small" />,
      children: [
        {
          id: "shelf.list",
          label: "List",
          icon: <CollectionsBookmarkIcon fontSize="small" />,
          to: "/shelf",
        },
      ],
    },
    {
      id: "misc",
      label: "Misc",
      icon: <StorageOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "misc.echokv",
          label: "EchoKV",
          icon: <StorageOutlinedIcon fontSize="small" />,
          to: "/misc/echokv",
        },
        {
          id: "misc.token",
          label: "Token",
          icon: <KeyOutlinedIcon fontSize="small" />,
          to: "/token",
        },
        {
          id: "misc.jwt-services",
          label: "JWT Services",
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/jwt-services",
          requiredRole: "owner",
        },
      ],
    },
    {
      id: "meili",
      label: "Meili",
      icon: <ManageSearchOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "meili.search",
          label: "Meili Search",
          to: "/meili",
          icon: <ManageSearchOutlinedIcon fontSize="small" />,
        },
      ],
    },
    {
      id: "auth",
      label: "Auth",
      icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "auth.users",
          label: "Users",
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: "/auth/users",
        },
        {
          id: "auth.sessions",
          label: "Sessions",
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: "/auth/sessions",
        },
        {
          id: "auth.status",
          label: "Auth Status",
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/auth/status",
        },
        {
          id: "auth.email",
          label: "Email Templates",
          icon: <EmailOutlinedIcon fontSize="small" />,
          to: "/auth/email",
        },
        {
          id: "auth.jwt-services",
          label: "Auth JWT Services",
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/auth/jwt-services",
          requiredRole: "owner",
        },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      icon: <SettingsIcon fontSize="small" />,
      to: "/settings",
    },
  ] satisfies AdminNavEntry[],
};
