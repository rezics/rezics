import { useTranslation } from "@rezics/i18n/react";
import { useRouterState } from "@tanstack/react-router";
import React from "react";
import { AuthenticatedSection } from "@/core/sections/header/AuthenticatedSection.tsx";
import { PendingVerificationSection } from "@/core/sections/header/PendingVerificationSection.tsx";
import { UnauthenticatedSection } from "@/core/sections/header/UnauthenticatedSection.tsx";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { useAuth } from "@/user";
import { useLayoutStore } from "../../states/layoutStore.ts";
import { DrawerToggler } from "./DrawerToggler.tsx";
import { HeaderSearch } from "./HeaderSearch.tsx";

/**
 * Main application header bar, fixed to the top of the viewport.
 * 应用主头部栏，固定在视口顶部。
 *
 * Renders three zones left-to-right: [drawer toggle + logo] · [search] · [auth section].
 * Layout shifts at the `md` breakpoint (768 px); `useIsMobile` (≤768 px) further
 * controls which sub-components render inside HeaderSearch and UnauthenticatedSection.
 *
 * 从左到右渲染三个区域：[抽屉开关 + Logo] · [搜索] · [认证区域]。
 * 布局在 `md` 断点（768px）处切换；`useIsMobile`（≤768px）进一步控制
 * HeaderSearch 和 UnauthenticatedSection 内部子组件的渲染形式。
 *
 * ---
 *
 * ### Mobile  (<768px, `useIsMobile` = true)
 * 移动端：高度 49px，水平内边距 8px，搜索栏折叠为图标按钮（首页时隐藏）。
 * 未登录时仅显示"登录"按钮 + 更多菜单图标；已登录时显示通知 + 创建 + 头像菜单。
 *
 * ```
 * ┌──────────────────────────────────────────────────────┐  h=49px
 * │ [≡] [logo?] REZICS      [🔍]  [Login] [•••]         │  px=8px
 * └──────────────────────────────────────────────────────┘
 *        │                   │       │       │
 *      DrawerToggler    SearchIcon  Login  MoreHorizMenu
 *      (always shown)  (icon only, (link)  (theme/lang)
 *                       hidden on
 *                       home page)
 *
 * Authenticated variant:
 * ┌──────────────────────────────────────────────────────┐
 * │ [≡] [logo?] REZICS      [🔍]  [🔔] [+] [avatar]    │
 * └──────────────────────────────────────────────────────┘
 *                                     │    │    │
 *                                  Bell  Create AccountMenu
 * ```
 *
 * ---
 *
 * ### Tablet  (768px – 1023px, `md:` styles apply, `useIsMobile` = false)
 * 平板端：高度切换为 56px，水平内边距增至 24px，间距扩大；搜索栏展开为全宽输入框
 * （最大宽度 560px，居中），未登录时同时显示"登录"和"注册"两个按钮。
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐  h=56px
 * │ [≡] [logo?] REZICS   [icon/search-input  max-w-560px]  [Login] [Register] [•••] │  px=24px
 * └─────────────────────────────────────────────────────────────────┘
 *                        │                                  │           │         │
 *                  pill input (badge                     Login btn  Register  MoreHorizMenu
 *                  for realm/zone/user                   (modal)    (modal)
 *                  context, or logo icon
 *                  for general search)
 *
 * Authenticated variant:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ [≡] [logo?] REZICS   [🔍 search-input  max-w-560px]  [🔔] [+] [avatar] │
 * └──────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ---
 *
 * ### Desktop  (1024px – 1535px, same `md:` styles)
 * 桌面端：布局与平板端相同，但页面整体宽度增大使搜索框在 560px 上限前有更多可用空间。
 * type-a 布局且侧边栏展开时，`marginLeft` 和 `width` 会随抽屉宽度偏移，
 * 同时抽屉开关按钮隐藏（由侧边栏本身提供关闭入口）。
 *
 * ```
 * ┌──────────────────────────────────────────────────────────────────────────────┐  h=56px
 * │ [≡] [logo?] REZICS        [🔍 ───────search──────── max-w-560px]  [auth…]  │  px=24px
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * type-a with sidebar open:
 * ◀── drawerWidth ──▶
 *                    ┌──────────────────────────────────────────────────────────┐
 *                    │   [logo?] REZICS   [🔍 ─search─ max-w-560px]  [auth…]  │
 *                    └──────────────────────────────────────────────────────────┘
 *                     width = 100% - drawerWidth  (animated, ease-out 225ms)
 * ```
 *
 * ---
 *
 * ### Ultra-wide  (≥1536px, `2xl:` — no additional header-specific overrides)
 * 超宽屏：无专属头部断点覆盖，表现与桌面端一致；搜索框受 max-w-[560px] 限制，
 * 不会随容器继续扩展；两侧留白随内容区域增大而自然扩展。
 *
 * ```
 * ┌────────────────────────────────────────────────────────────────────────────────────┐  h=56px
 * │ [≡] [logo?] REZICS              [🔍 search  560px cap]               [auth…]     │  px=24px
 * │               ◀──── growing whitespace ────▶               ◀── whitespace ──▶     │
 * └────────────────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ---
 *
 * ### Auth section variants
 * 认证区域根据用户状态渲染三种形态之一：
 *
 * - **Unauthenticated** — Login button (modal on ≥769px, route `/login` on mobile) +
 *   Register button (desktop only, modal) + MoreHorizMenu (theme/language)
 *   / 未登录：登录按钮（桌面弹窗，移动端跳转路由） + 注册按钮（仅桌面端，弹窗） + 更多菜单
 * - **PendingVerification** — "Complete registration" link button + Logout button
 *   / 待验证：完成注册链接按钮 + 登出按钮
 * - **Authenticated** — Notifications bell (with unread badge, max "99+") +
 *   CreateMenu (SquarePlus icon) + AccountMenu (avatar, profile/settings/logout)
 *   / 已登录：通知铃铛（未读角标，最多显示"99+"）+ 创建菜单 + 账户菜单（头像、个人资料/设置/登出）
 */
interface HeaderProps {
  isDragging?: boolean;
  layoutType?: "type-a" | "type-b";
  disableDrawerToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = React.memo(
  ({
    isDragging = false,
    layoutType = "type-b",
    disableDrawerToggle = false,
  }) => {
    const { t } = useTranslation(["common"]);
    const sidebarOpen = useLayoutStore((s) => s.sidebarOpen);
    const drawerWidth = useLayoutStore((s) => s.drawerWidth);
    const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);

    const isHomePage = useRouterState({
      select: (s) => s.location.pathname === "/",
    });

    const handleDrawerToggle = () => {
      if (!disableDrawerToggle) toggleSidebar();
    };

    const auth = useAuth();

    const authSection = (() => {
      if (auth.readyForApp && auth.user) return <AuthenticatedSection />;
      if (auth.hasAuthIdentity && !auth.registrationComplete)
        return <PendingVerificationSection />;
      return <UnauthenticatedSection />;
    })();

    const isOffsetByDrawer = layoutType === "type-a" && sidebarOpen;

    return (
      <header
        className={cn(
          "fixed top-0 z-40 bg-surface-canvas border-b border-border-whisper transition-[margin,width] duration-225 ease-out pointer-events-auto",
          isDragging && "rounded-tl-2xl rounded-bl-2xl",
        )}
        style={{
          marginLeft: isOffsetByDrawer ? `${drawerWidth}px` : 0,
          width: isOffsetByDrawer ? `calc(100% - ${drawerWidth}px)` : "100%",
        }}
      >
        <div className="flex h-[49px] items-center gap-1 px-2 md:h-14 md:gap-2 md:px-6">
          <DrawerToggler
            handleDrawerToggleInner={handleDrawerToggle}
            layoutType={layoutType}
            sidebarOpen={sidebarOpen}
          />

          <Link to="/" className="flex items-center gap-2 shrink-0">
            {!isHomePage && (
              <div className="w-10 h-10 inline-flex items-center justify-center rounded-md bg-transparent overflow-hidden">
                <img src="/logo.svg" alt={t("common:logo_alt")} />
              </div>
            )}
            <h1 className="text-3xl font-bold text-brand-fill m-0">REZICS</h1>
          </Link>

          <div className="flex flex-1 min-w-0 justify-end md:justify-center md:px-4">
            <HeaderSearch />
          </div>

          {authSection}
        </div>
      </header>
    );
  },
);
