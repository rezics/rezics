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
  admin_nav_low_score,
  admin_nav_meili,
  admin_nav_meili_search,
  admin_nav_realms,
  admin_nav_sessions,
  admin_nav_settings,
  admin_nav_shelves,
  admin_nav_token,
  admin_nav_units,
  admin_nav_users,
} from "@rezics/i18n/messages";
import {
  Activity as ActivityIcon,
  GitMerge as AccountTreeIcon,
  Wrench as BuildIcon,
  ShieldUser as AdminPanelSettingsOutlinedIcon,
  ShieldAlert as ShieldAlertIcon,
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
  admin_nav_low_score,
  admin_nav_meili,
  admin_nav_meili_search,
  admin_nav_realms,
  admin_nav_sessions,
  admin_nav_settings,
  admin_nav_shelves,
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
      id: "content-operations",
      label: () => "Content",
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: "content.units",
          label: i18nMessages.admin_nav_units,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit",
        },
        {
          id: "content.unit-create",
          label: () =>
            `${i18nMessages.admin_nav_units()} · ${i18nMessages.admin_nav_create()}`,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit/create",
        },
        {
          id: "content.books",
          label: i18nMessages.admin_nav_books,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/book",
        },
        {
          id: "content.work-merge",
          label: () => "Work merge",
          icon: <AccountTreeIcon fontSize="small" />,
          to: "/unit/work-merge",
        },
        {
          id: "content.entities",
          label: i18nMessages.admin_nav_entities,
          icon: <IdentityIcon fontSize="small" />,
          to: "/entity",
        },
        {
          id: "content.source-sites",
          label: () => "Source sites",
          icon: <NetworkIcon fontSize="small" />,
          to: "/source-site",
        },
        {
          id: "content.realms",
          label: i18nMessages.admin_nav_realms,
          icon: <ForumIcon fontSize="small" />,
          to: "/realm",
        },
        {
          id: "content.shelves",
          label: i18nMessages.admin_nav_shelves,
          icon: <CollectionsBookmarkIcon fontSize="small" />,
          to: "/shelf",
        },
        {
          id: "content.low-score-tags",
          label: i18nMessages.admin_nav_low_score,
          icon: <StyleOutlinedIcon fontSize="small" />,
          to: "/tag/low-score",
        },
      ],
    },
    {
      id: "account-operations",
      label: () => "Accounts",
      icon: <PeopleIcon fontSize="small" />,
      children: [
        {
          id: "accounts.auth-users",
          label: i18nMessages.admin_nav_auth,
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: "/auth/users",
        },
        {
          id: "accounts.main-users",
          label: i18nMessages.admin_nav_users,
          icon: <PeopleIcon fontSize="small" />,
          to: "/user",
        },
        {
          id: "accounts.user-create",
          label: () =>
            `${i18nMessages.admin_nav_users()} · ${i18nMessages.admin_nav_create()}`,
          icon: <PeopleIcon fontSize="small" />,
          to: "/user/create",
        },
        {
          id: "accounts.sessions",
          label: i18nMessages.admin_nav_sessions,
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: "/auth/sessions",
        },
        {
          id: "accounts.auth-status",
          label: i18nMessages.admin_nav_auth_status,
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/auth/status",
        },
        {
          id: "accounts.email",
          label: i18nMessages.admin_nav_auth_email_templates,
          icon: <EmailOutlinedIcon fontSize="small" />,
          to: "/auth/email",
        },
        {
          id: "accounts.auth-jwt-services",
          label: i18nMessages.admin_nav_auth_jwt_services,
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/auth/jwt-services",
          requiredRole: "owner",
        },
        {
          id: "accounts.tokens",
          label: i18nMessages.admin_nav_token,
          icon: <KeyOutlinedIcon fontSize="small" />,
          to: "/token",
        },
      ],
    },
    {
      id: "governance-operations",
      label: () => "Governance",
      icon: <ShieldCheckIcon fontSize="small" />,
      children: [
        {
          id: "governance.overview",
          label: () => "Overview",
          icon: <ShieldAlertIcon fontSize="small" />,
          to: "/governance",
        },
        {
          id: "governance.authority",
          label: i18nMessages.admin_nav_authority,
          icon: <ShieldCheckIcon fontSize="small" />,
          to: "/authority",
        },
        {
          id: "governance.realm-escalations",
          label: i18nMessages.admin_nav_realms,
          icon: <ForumIcon fontSize="small" />,
          to: "/realm",
        },
      ],
    },
    {
      id: "search-sync-operations",
      label: () => "Search / Sync",
      icon: <ManageSearchOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "search.meili",
          label: i18nMessages.admin_nav_meili,
          icon: <ManageSearchOutlinedIcon fontSize="small" />,
          to: "/meili",
        },
        {
          id: "search.meili-observability",
          label: () => "狀態觀測",
          to: "/meili/observability",
          icon: <ActivityIcon fontSize="small" />,
        },
        {
          id: "search.repair",
          label: () => "Repair jobs",
          icon: <BuildIcon fontSize="small" />,
          to: "/repair",
        },
        {
          id: "search.unit-meili",
          label: () =>
            `${i18nMessages.admin_nav_units()} · ${i18nMessages.admin_nav_meili_search()}`,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit/meili",
        },
        {
          id: "search.book-meili",
          label: () =>
            `${i18nMessages.admin_nav_books()} · ${i18nMessages.admin_nav_meili_search()}`,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/book/meili",
        },
        {
          id: "search.user-meili",
          label: () =>
            `${i18nMessages.admin_nav_users()} · ${i18nMessages.admin_nav_meili_search()}`,
          icon: <PeopleIcon fontSize="small" />,
          to: "/user/meili",
        },
      ],
    },
    {
      id: "system-operations",
      label: () => "System",
      icon: <StorageOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "system.status",
          label: () => "系統狀態",
          icon: <ActivityIcon fontSize="small" />,
          to: "/status",
        },
        {
          id: "misc.echokv",
          label: i18nMessages.admin_nav_echokv,
          icon: <StorageOutlinedIcon fontSize="small" />,
          to: "/misc/echokv",
        },
        {
          id: "misc.token",
          label: i18nMessages.admin_nav_settings,
          icon: <SettingsIcon fontSize="small" />,
          to: "/settings",
        },
        {
          id: "system.legacy-token",
          label: i18nMessages.admin_nav_token,
          icon: <KeyOutlinedIcon fontSize="small" />,
          to: "/token",
        },
        {
          id: "system.jwt-services",
          label: i18nMessages.admin_nav_jwt_services,
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/jwt-services",
          requiredRole: "owner",
        },
      ],
    },
  ] satisfies AdminNavEntry[],
};
