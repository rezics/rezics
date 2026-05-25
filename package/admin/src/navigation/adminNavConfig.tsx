import {
  admin_nav_auth,
  admin_nav_auth_email_templates,
  admin_nav_auth_jwt_services,
  admin_nav_auth_status,
  admin_nav_authority,
  admin_nav_books,
  admin_nav_create,
  admin_nav_dashboard,
  admin_nav_echokv,
  admin_nav_entities,
  admin_nav_jwt_services,
  admin_nav_list,
  admin_nav_low_score,
  admin_nav_meili,
  admin_nav_meili_search,
  admin_nav_misc,
  admin_nav_realms,
  admin_nav_sessions,
  admin_nav_settings,
  admin_nav_shelves,
  admin_nav_tags,
  admin_nav_token,
  admin_nav_units,
  admin_nav_users,
} from "@rezics/i18n/messages";
import {
  Activity as ActivityIcon,
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

const i18nMessages = {
  admin_nav_auth,
  admin_nav_auth_email_templates,
  admin_nav_auth_jwt_services,
  admin_nav_auth_status,
  admin_nav_authority,
  admin_nav_books,
  admin_nav_create,
  admin_nav_dashboard,
  admin_nav_echokv,
  admin_nav_entities,
  admin_nav_jwt_services,
  admin_nav_list,
  admin_nav_low_score,
  admin_nav_meili,
  admin_nav_meili_search,
  admin_nav_misc,
  admin_nav_realms,
  admin_nav_sessions,
  admin_nav_settings,
  admin_nav_shelves,
  admin_nav_tags,
  admin_nav_token,
  admin_nav_units,
  admin_nav_users,
};

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
      label: i18nMessages.admin_nav_dashboard,
      icon: <DashboardIcon fontSize="small" />,
      to: "/",
    },
    {
      id: "status",
      label: () => "系統狀態",
      icon: <ActivityIcon fontSize="small" />,
      to: "/status",
    },
    {
      id: "user",
      label: i18nMessages.admin_nav_users,
      icon: <PeopleIcon fontSize="small" />,
      children: [
        {
          id: "user.list",
          label: i18nMessages.admin_nav_list,
          icon: <PeopleIcon fontSize="small" />,
          to: "/user",
        },
        {
          id: "user.meili",
          label: i18nMessages.admin_nav_meili_search,
          icon: <PeopleIcon fontSize="small" />,
          to: "/user/meili",
        },
        {
          id: "user.create",
          label: i18nMessages.admin_nav_create,
          icon: <PeopleIcon fontSize="small" />,
          to: "/user/create",
        },
      ],
    },
    {
      id: "unit",
      label: i18nMessages.admin_nav_units,
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: "unit.list",
          label: i18nMessages.admin_nav_list,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit",
        },
        {
          id: "unit.meili",
          label: i18nMessages.admin_nav_meili_search,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit/meili",
        },
        {
          id: "unit.create",
          label: i18nMessages.admin_nav_create,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit/create",
        },
      ],
    },
    {
      id: "book",
      label: i18nMessages.admin_nav_books,
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: "book.list",
          label: i18nMessages.admin_nav_list,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/book",
        },
        {
          id: "book.meili",
          label: i18nMessages.admin_nav_meili_search,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/book/meili",
        },
      ],
    },
    {
      id: "entities",
      label: i18nMessages.admin_nav_entities,
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
      label: i18nMessages.admin_nav_authority,
      icon: <ShieldCheckIcon fontSize="small" />,
      to: "/authority",
    },
    // MOCK: realm management pages not yet implemented
    {
      id: "realm",
      label: i18nMessages.admin_nav_realms,
      icon: <ForumIcon fontSize="small" />,
      children: [
        {
          id: "realm.list",
          label: i18nMessages.admin_nav_list,
          icon: <ForumIcon fontSize="small" />,
          to: "/realm",
        },
      ],
    },
    {
      id: "tag",
      label: i18nMessages.admin_nav_tags,
      icon: <StyleOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "tag.low-score",
          label: i18nMessages.admin_nav_low_score,
          icon: <StyleOutlinedIcon fontSize="small" />,
          to: "/tag/low-score",
        },
      ],
    },
    // MOCK: shelf management pages not yet implemented
    {
      id: "shelf",
      label: i18nMessages.admin_nav_shelves,
      icon: <CollectionsBookmarkIcon fontSize="small" />,
      children: [
        {
          id: "shelf.list",
          label: i18nMessages.admin_nav_list,
          icon: <CollectionsBookmarkIcon fontSize="small" />,
          to: "/shelf",
        },
      ],
    },
    {
      id: "misc",
      label: i18nMessages.admin_nav_misc,
      icon: <StorageOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "misc.echokv",
          label: i18nMessages.admin_nav_echokv,
          icon: <StorageOutlinedIcon fontSize="small" />,
          to: "/misc/echokv",
        },
        {
          id: "misc.token",
          label: i18nMessages.admin_nav_token,
          icon: <KeyOutlinedIcon fontSize="small" />,
          to: "/token",
        },
        {
          id: "misc.jwt-services",
          label: i18nMessages.admin_nav_jwt_services,
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/jwt-services",
          requiredRole: "owner",
        },
      ],
    },
    {
      id: "meili",
      label: i18nMessages.admin_nav_meili,
      icon: <ManageSearchOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "meili.operations",
          label: () => "操作",
          to: "/meili",
          icon: <ManageSearchOutlinedIcon fontSize="small" />,
        },
        {
          id: "meili.observability",
          label: () => "狀態觀測",
          to: "/meili/observability",
          icon: <ActivityIcon fontSize="small" />,
        },
      ],
    },
    {
      id: "auth",
      label: i18nMessages.admin_nav_auth,
      icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "auth.users",
          label: i18nMessages.admin_nav_users,
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: "/auth/users",
        },
        {
          id: "auth.sessions",
          label: i18nMessages.admin_nav_sessions,
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: "/auth/sessions",
        },
        {
          id: "auth.status",
          label: i18nMessages.admin_nav_auth_status,
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/auth/status",
        },
        {
          id: "auth.email",
          label: i18nMessages.admin_nav_auth_email_templates,
          icon: <EmailOutlinedIcon fontSize="small" />,
          to: "/auth/email",
        },
        {
          id: "auth.jwt-services",
          label: i18nMessages.admin_nav_auth_jwt_services,
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/auth/jwt-services",
          requiredRole: "owner",
        },
      ],
    },
    {
      id: "settings",
      label: i18nMessages.admin_nav_settings,
      icon: <SettingsIcon fontSize="small" />,
      to: "/settings",
    },
  ] satisfies AdminNavEntry[],
};
