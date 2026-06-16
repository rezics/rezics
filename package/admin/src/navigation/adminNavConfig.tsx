import { getI18nRuntime } from "@rezics/i18n/runtime";

import {
  Activity as ActivityIcon,
  ShieldUser as AdminPanelSettingsOutlinedIcon,
  ScrollText as AuditIcon,
  Wrench as BuildIcon,
  Gavel as CasesIcon,
  DatabaseZap as CdcIcon,
  BookMarked as CollectionsBookmarkIcon,
  LayoutDashboard as DashboardIcon,
  Mail as EmailOutlinedIcon,
  ShieldBan as EnforcementIcon,
  MessagesSquare as ForumIcon,
  History as HistoryIcon,
  IdCard as IdentityIcon,
  Package as Inventory2Icon,
  Key as KeyOutlinedIcon,
  SearchCheck as ManageSearchOutlinedIcon,
  Network as NetworkIcon,
  Users as PeopleIcon,
  FileText as PostIcon,
  ListChecks as QueueIcon,
  Star as ReviewIcon,
  Server as ServerIcon,
  Settings as SettingsIcon,
  ShieldAlert as ShieldAlertIcon,
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
  /**
   * Marks a routed-but-unbuilt destination. The item links normally to its
   * `to` (which resolves to a route rendering `PlaceholderPage`); the nav adds
   * a muted "soon" affordance. Not a disabled item — the spine stays
   * deep-linkable while the feature lands behind it.
   * 标记一个已配置路由但尚未构建的目标。该项正常链接到其 `to`（会解析到渲染
   * `PlaceholderPage` 的路由）；导航会添加一个淡化的“即将上线”提示。它不是禁用项——
   * 在功能落地之前，主干仍可深链接访问。
   */
  placeholder?: true;
};

export type AdminNavGroup = {
  id: string;
  label: () => string;
  icon: React.ReactNode;
  children: AdminNavItem[];
};

export type AdminNavEntry = AdminNavItem | AdminNavGroup;

// The top-level spine is grouped by *operator intent* (Content / Governance /
// Accounts & Access / Operations / System), not by the service a target
// happens to live in. This grouping axis is a deliberate IA choice: it keeps
// the product shape stable and deep-linkable as surfaces land. Three invariants
// that are easy to violate by hand, restated here:
//   1. Every `to` is unique across the flattened tree — no two entries own the
//      same route (that is what makes the spine a navigation map, not a list).
//      Enforced by `adminNavConfig.test.ts`.
//   2. Every `label` thunk resolves through the admin namespace with a full
//      literal key — no hardcoded display strings (so the spine is
//      translatable) and no dynamic/template keys (convention R11). Also
//      enforced by `adminNavConfig.test.ts`.
//   3. "Create" is an action, not a destination: `/unit/create` and
//      `/user/create` stay routable and are reached from their list pages, so
//      they are deliberately absent here.
// 顶层主干按*运营者意图*分组（Content / Governance / Accounts & Access /
// Operations / System），而非按目标恰好所在的服务分组。这一分组轴是刻意的信息架构
// 选择：随着各界面陆续落地，它能让产品形态保持稳定且可深链接。这里重申三条手工
// 编辑时容易违反的不变量：
//   1. 在扁平化后的树中每个 `to` 都唯一——没有两个条目拥有相同路由（这正是主干成为
//      导航地图而非列表的原因）。由 `adminNavConfig.test.ts` 强制保证。
//   2. 每个 `label` thunk 都通过 admin 命名空间用完整字面量 key 解析——不允许硬编码
//      显示字符串（以保证主干可翻译），也不允许动态/模板 key（约定 R11）。同样由
//      `adminNavConfig.test.ts` 强制保证。
//   3. “Create”是动作而非目标：`/unit/create` 与 `/user/create` 仍保持可路由，并从各自
//      的列表页进入，因此它们在此处被刻意省略。
export const adminNav = {
  drawerWidth: 260,
  items: [
    {
      id: "dashboard",
      label: () => getI18nRuntime().i18n.t("admin:nav_dashboard"),
      icon: <DashboardIcon fontSize="small" />,
      to: "/",
    },
    {
      id: "content",
      label: () => getI18nRuntime().i18n.t("admin:nav_group_content"),
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: "content.units",
          label: () => getI18nRuntime().i18n.t("admin:nav_units"),
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit",
        },
        {
          id: "content.books",
          label: () => getI18nRuntime().i18n.t("admin:nav_books"),
          icon: <Inventory2Icon fontSize="small" />,
          to: "/book",
        },
        {
          id: "content.entities",
          label: () => getI18nRuntime().i18n.t("admin:nav_entities"),
          icon: <IdentityIcon fontSize="small" />,
          to: "/entity",
        },
        {
          id: "content.source-sites",
          label: () => getI18nRuntime().i18n.t("admin:nav_source_sites"),
          icon: <NetworkIcon fontSize="small" />,
          to: "/source-site",
        },
        {
          id: "content.realms",
          label: () => getI18nRuntime().i18n.t("admin:nav_realms"),
          icon: <ForumIcon fontSize="small" />,
          to: "/realm",
        },
        {
          id: "content.shelves",
          label: () => getI18nRuntime().i18n.t("admin:nav_shelves"),
          icon: <CollectionsBookmarkIcon fontSize="small" />,
          to: "/shelf",
        },
        {
          // Tags has no index route yet; it points at the existing low-score
          // view on purpose (see plan out-of-scope), not by oversight.
          // Tags 尚无索引路由；它有意指向现有的 low-score 视图（见计划的 out-of-scope），
          // 而非疏忽所致。
          id: "content.tags",
          label: () => getI18nRuntime().i18n.t("admin:nav_tags"),
          icon: <StyleOutlinedIcon fontSize="small" />,
          to: "/tag/low-score",
        },
        {
          id: "content.posts",
          label: () => getI18nRuntime().i18n.t("admin:nav_posts"),
          icon: <PostIcon fontSize="small" />,
          to: "/post",
          placeholder: true,
        },
        {
          id: "content.reviews",
          label: () => getI18nRuntime().i18n.t("admin:nav_reviews"),
          icon: <ReviewIcon fontSize="small" />,
          to: "/review",
          placeholder: true,
        },
      ],
    },
    {
      id: "governance",
      label: () => getI18nRuntime().i18n.t("admin:nav_group_governance"),
      icon: <ShieldCheckIcon fontSize="small" />,
      children: [
        {
          id: "governance.overview",
          label: () => getI18nRuntime().i18n.t("admin:nav_governance_overview"),
          icon: <ShieldAlertIcon fontSize="small" />,
          to: "/governance",
        },
        {
          id: "governance.authority",
          label: () => getI18nRuntime().i18n.t("admin:nav_authority"),
          icon: <ShieldCheckIcon fontSize="small" />,
          to: "/authority",
        },
        {
          id: "governance.cases",
          label: () => getI18nRuntime().i18n.t("admin:nav_governance_cases"),
          icon: <CasesIcon fontSize="small" />,
          to: "/governance/cases",
          placeholder: true,
        },
        {
          id: "governance.audit",
          label: () => getI18nRuntime().i18n.t("admin:nav_governance_audit"),
          icon: <AuditIcon fontSize="small" />,
          to: "/governance/audit",
          placeholder: true,
        },
        {
          id: "governance.enforcement",
          label: () =>
            getI18nRuntime().i18n.t("admin:nav_governance_enforcement"),
          icon: <EnforcementIcon fontSize="small" />,
          to: "/governance/enforcement",
          placeholder: true,
        },
      ],
    },
    {
      id: "accounts",
      label: () => getI18nRuntime().i18n.t("admin:nav_group_accounts"),
      icon: <PeopleIcon fontSize="small" />,
      children: [
        {
          id: "accounts.auth-users",
          label: () => getI18nRuntime().i18n.t("admin:nav_auth"),
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: "/auth/users",
        },
        {
          id: "accounts.main-users",
          label: () => getI18nRuntime().i18n.t("admin:nav_users"),
          icon: <PeopleIcon fontSize="small" />,
          to: "/user",
        },
        {
          id: "accounts.sessions",
          label: () => getI18nRuntime().i18n.t("admin:nav_sessions"),
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: "/auth/sessions",
        },
        {
          id: "accounts.auth-status",
          label: () => getI18nRuntime().i18n.t("admin:nav_auth_status"),
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/auth/status",
        },
        {
          id: "accounts.email",
          label: () =>
            getI18nRuntime().i18n.t("admin:nav_auth_email_templates"),
          icon: <EmailOutlinedIcon fontSize="small" />,
          to: "/auth/email",
        },
        {
          // auth-service registry of trusted JWT *consumers*. Distinct system
          // from `system.jwt-services` (/jwt-services, main-server) below —
          // both stay; do not "dedupe" them.
          // auth-service 维护的受信任 JWT *消费方*注册表。与下方的
          // `system.jwt-services`（/jwt-services，main-server）是不同的系统——
          // 两者都保留；不要将它们“去重”。
          id: "accounts.auth-jwt-services",
          label: () => getI18nRuntime().i18n.t("admin:nav_auth_jwt_services"),
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/auth/jwt-services",
          requiredRole: "owner",
        },
        {
          id: "accounts.tokens",
          label: () => getI18nRuntime().i18n.t("admin:nav_token"),
          icon: <KeyOutlinedIcon fontSize="small" />,
          to: "/token",
        },
      ],
    },
    {
      id: "operations",
      label: () => getI18nRuntime().i18n.t("admin:nav_group_operations"),
      icon: <ActivityIcon fontSize="small" />,
      children: [
        {
          id: "operations.status",
          label: () => getI18nRuntime().i18n.t("admin:nav_status_overview"),
          icon: <ActivityIcon fontSize="small" />,
          to: "/status",
        },
        {
          id: "operations.status-services",
          label: () => getI18nRuntime().i18n.t("admin:nav_status_services"),
          icon: <ServerIcon fontSize="small" />,
          to: "/status/services",
        },
        {
          id: "operations.status-queue",
          label: () => getI18nRuntime().i18n.t("admin:nav_status_queue"),
          icon: <QueueIcon fontSize="small" />,
          to: "/status/queue",
        },
        {
          id: "operations.status-cdc",
          label: () => getI18nRuntime().i18n.t("admin:nav_status_cdc"),
          icon: <CdcIcon fontSize="small" />,
          to: "/status/cdc",
        },
        {
          id: "operations.status-history",
          label: () => getI18nRuntime().i18n.t("admin:nav_status_history"),
          icon: <HistoryIcon fontSize="small" />,
          to: "/status/history",
        },
        {
          id: "operations.meili",
          label: () => getI18nRuntime().i18n.t("admin:nav_meili"),
          icon: <ManageSearchOutlinedIcon fontSize="small" />,
          to: "/meili",
        },
        {
          id: "operations.meili-observability",
          label: () => getI18nRuntime().i18n.t("admin:nav_meili_observability"),
          icon: <ActivityIcon fontSize="small" />,
          to: "/meili/observability",
        },
        {
          id: "operations.repair",
          label: () => getI18nRuntime().i18n.t("admin:nav_repair"),
          icon: <BuildIcon fontSize="small" />,
          to: "/repair",
        },
        {
          id: "operations.unit-meili",
          label: () =>
            `${getI18nRuntime().i18n.t("admin:nav_units")} · ${getI18nRuntime().i18n.t("admin:nav_meili_search")}`,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/unit/meili",
        },
        {
          id: "operations.book-meili",
          label: () =>
            `${getI18nRuntime().i18n.t("admin:nav_books")} · ${getI18nRuntime().i18n.t("admin:nav_meili_search")}`,
          icon: <Inventory2Icon fontSize="small" />,
          to: "/book/meili",
        },
        {
          id: "operations.user-meili",
          label: () =>
            `${getI18nRuntime().i18n.t("admin:nav_users")} · ${getI18nRuntime().i18n.t("admin:nav_meili_search")}`,
          icon: <PeopleIcon fontSize="small" />,
          to: "/user/meili",
        },
      ],
    },
    {
      id: "system",
      label: () => getI18nRuntime().i18n.t("admin:nav_group_system"),
      icon: <StorageOutlinedIcon fontSize="small" />,
      children: [
        {
          id: "system.echokv",
          label: () => getI18nRuntime().i18n.t("admin:nav_echokv"),
          icon: <StorageOutlinedIcon fontSize="small" />,
          to: "/misc/echokv",
        },
        {
          id: "system.settings",
          label: () => getI18nRuntime().i18n.t("admin:nav_settings"),
          icon: <SettingsIcon fontSize="small" />,
          to: "/settings",
        },
        {
          // main-server registry of issued JWT *services*. Distinct system from
          // `accounts.auth-jwt-services` (/auth/jwt-services, auth-service)
          // above — both stay; do not "dedupe" them.
          // main-server 维护的已签发 JWT *服务*注册表。与上方的
          // `accounts.auth-jwt-services`（/auth/jwt-services，auth-service）是不同的
          // 系统——两者都保留；不要将它们“去重”。
          id: "system.jwt-services",
          label: () => getI18nRuntime().i18n.t("admin:nav_jwt_services"),
          icon: <VpnKeyOutlinedIcon fontSize="small" />,
          to: "/jwt-services",
          requiredRole: "owner",
        },
      ],
    },
  ] satisfies AdminNavEntry[],
};
