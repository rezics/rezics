import * as m from "@rezics/i18n/messages";
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
  Network as NetworkIcon,
  Users as PeopleIcon,
  Settings as SettingsIcon,
  ShieldCheck as ShieldCheckIcon,
  Database as StorageOutlinedIcon,
  Tags as StyleOutlinedIcon,
  KeyRound as VpnKeyOutlinedIcon,
} from "lucide-react";
import type React from "react";

export type AdminNavItem = {
  id: string;
  label: () => string;
  icon: React.ReactNode;
  to: string;
  requiredRole?: "owner";
};

export type AdminNavGroup = {
  id: string;
  label: () => string;
  icon: React.ReactNode;
  children: AdminNavItem[];
};

export type AdminNavEntry = AdminNavItem | AdminNavGroup;

export const adminNav = {
  drawerWidth: 260,
  items: [
    {
      id: "dashboard",
      label: m.admin_nav_dashboard,
      icon: <DashboardIcon fontSize="small" />,
      to: "/",
    },
    {
      id: "user",
      label: m.admin_nav_users,
      icon: <PeopleIcon fontSize="small" />,
      children: [
        {
          id: "user.list",
          label: m.admin_nav_list,
          icon: <PeopleIcon fontSize="small" />,
          to: "/user",
        },
        {
          id: "user.meili",
          label: m.admin_nav_meili_search,
          icon: <PeopleIcon fontSize="small" />,
          to: "/user/meili",
        },
        {
          id: "user.create",
          label: m.admin_nav_create,
          icon: <PeopleIcon fontSize="small" />,
          to: "/user/create",
        },
      ],
    },
    {
      id: "unit",
      label: m.admin_nav_units,
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: "unit.list",
          label: m.admin_nav_list,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit",
        },
        {
          id: "unit.meili",
          label: m.admin_nav_meili_search,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit/meili",
        },
        {
          id: "unit.create",
          label: m.admin_nav_create,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit/create",
        },
      ],
    },
    {
      id: "book",
      label: m.admin_nav_books,
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: "book.list",
          label: m.admin_nav_list,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/book",
        },
        {
          id: "book.meili",
          label: m.admin_nav_meili_search,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/book/meili",
        },
      ],
    },
    {
      id: "entities",
      label: m.admin_nav_entities,
      icon: <IdentityIcon fontSize="small" />,
      to: "/entity",
    },
    {
      id: "source-site",
      label: () => "Source sites",
      icon: <NetworkIcon fontSize="small" />,
      to: "/source-site",
    },
    {
      id: "authority",
      label: m.admin_nav_authority,
      icon: <ShieldCheckIcon fontSize="small" />,
      to: "/authority",
    },
    // MOCK: realm management pages not yet implemented
    {
      id: "realm",
      label: m.admin_nav_realms,
      icon: <ForumIcon fontSize="small" />,
      children: [
        {
          id: "realm.list",
          label: m.admin_nav_list,
          icon: <ForumIcon fontSize="small" />,
          to: "/realm",
        },
      ],
    },
    {
      id: "tag",
      label: m.admin_nav_tags,
      icon: <StyleOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "tag.low-score",
          label: m.admin_nav_low_score,
          icon: <StyleOutlinedIcon fontSize="small" />,
          to: "/tag/low-score",
        },
      ],
    },
    // MOCK: shelf management pages not yet implemented
    {
      id: "shelf",
      label: m.admin_nav_shelves,
      icon: <CollectionsBookmarkIcon fontSize="small" />,
      children: [
        {
          id: "shelf.list",
          label: m.admin_nav_list,
          icon: <CollectionsBookmarkIcon fontSize="small" />,
          to: "/shelf",
        },
      ],
    },
    {
      id: "misc",
      label: m.admin_nav_misc,
      icon: <StorageOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "misc.echokv",
          label: m.admin_nav_echokv,
          icon: <StorageOutlinedIcon fontSize="small" />,
          to: "/misc/echokv",
        },
        {
          id: "misc.token",
          label: m.admin_nav_token,
          icon: <KeyOutlinedIcon fontSize="small" />,
          to: "/token",
        },
        {
          id: "misc.jwt-services",
          label: m.admin_nav_jwt_services,
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/jwt-services",
          requiredRole: "owner",
        },
      ],
    },
    {
      id: "meili",
      label: m.admin_nav_meili,
      icon: <ManageSearchOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "meili.search",
          label: m.admin_nav_meili_search,
          to: "/meili",
          icon: <ManageSearchOutlinedIcon fontSize="small" />,
        },
      ],
    },
    {
      id: "auth",
      label: m.admin_nav_auth,
      icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "auth.users",
          label: m.admin_nav_users,
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: "/auth/users",
        },
        {
          id: "auth.sessions",
          label: m.admin_nav_sessions,
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: "/auth/sessions",
        },
        {
          id: "auth.status",
          label: m.admin_nav_auth_status,
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/auth/status",
        },
        {
          id: "auth.email",
          label: m.admin_nav_auth_email_templates,
          icon: <EmailOutlinedIcon fontSize="small" />,
          to: "/auth/email",
        },
        {
          id: "auth.jwt-services",
          label: m.admin_nav_auth_jwt_services,
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/auth/jwt-services",
          requiredRole: "owner",
        },
      ],
    },
    {
      id: "settings",
      label: m.admin_nav_settings,
      icon: <SettingsIcon fontSize="small" />,
      to: "/settings",
    },
  ] satisfies AdminNavEntry[],
};
