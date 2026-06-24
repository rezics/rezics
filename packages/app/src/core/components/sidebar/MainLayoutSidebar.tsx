import { useRouterState } from "@tanstack/react-router";
import type React from "react";
import type { ReactNode } from "react";
import { cn } from "@/shared/utils/css-util";
import { useIsMobile } from "@/shared/utils/use-media-query";
import { useLayoutStore } from "../../states/layoutStore";
import type { NavigationItem } from "../navigation/navigation";
import { MainSidebarMenuSection } from "./MainSidebarMenuSection";
import { Sidebar as UiSidebar } from "./sidebar";

/**
 * 主布局侧边栏 — 根据屏幕宽度在抽屉叠加层（移动端）和内嵌推开模式（桌面端）之间切换。
 * Main layout sidebar that switches between a drawer overlay (mobile) and
 * an inline push mode (desktop) depending on screen width.
 *
 * Breakpoint behaviour / 各断点行为：
 *
 * - `useIsMobile` fires at ≤768 px (fixed/overlay mode)
 * - `getInitialSidebarOpen` opens by default at >960 px
 * - Default `drawerWidth` = 280 px; resizable via `layoutStore.drawerWidth`
 *
 * ---
 *
 * **Mobile  (<768 px)** — `mode="fixed"`, overlay drawer, auto-closes on nav
 * 移动端：固定定位叠加层抽屉，导航后自动关闭。
 *
 * ```
 * ┌────────────────────┐
 * │ Header             │  ← TopBar (separate, always visible)
 * ├────────────────────┤
 * │░░░░░░░░░░░░░░░░░░░░│  ← content (no sidebar reserved width)
 * │░░░░░░░░░░░░░░░░░░░░│
 * │░░░░░░░░░░░░░░░░░░░░│
 * └────────────────────┘
 *
 *   (drawer open — slides in from left, backdrop behind)
 * ┌────────────┬───────┐
 * │ [≡] Logo  [X]      │  ← close button (X) — fixed mode only
 * ├────────────┤░░░░░░░│
 * │ [Home]     │░░░░░░░│  ← nav items (icon + label, h-10 rows)
 * │ ─────────  │░░░░░░░│  ← divider between groups
 * │ > ZONES    │░░░░░░░│  ← collapsible section header (ChevronDown/Up)
 * │   All Zon. │░░░░░░░│
 * │   Zone A   │░░░░░░░│
 * │ > REALMS   │░░░░░░░│
 * │   Realm A  │░░░░░░░│
 * │   Realm B  │░░░░░░░│
 * ├────────────┤░░░░░░░│
 * │ [children] │░░░░░░░│  ← optional children slot (flex-1, scrollable)
 * └────────────┴───────┘
 *  ←-- 280px -->
 * ```
 *
 * ---
 *
 * **Tablet  (769 px – 960 px)** — `mode="inline"`, closed by default
 * 平板端：内嵌模式，默认折叠（初始宽度占位为 0）。
 *
 * ```
 * ┌──────────────────────────────────────┐
 * │ Header                               │
 * ├──────────────────────────────────────┤
 * │  content fills full width            │  ← sidebar collapsed, width=0
 * │  (toggle button in header opens it)  │
 * └──────────────────────────────────────┘
 *
 *   (drawer open — slides in, spacer div grows to 280 px, content shrinks)
 * ┌────────────┬─────────────────────────┐
 * │            │                         │
 * │ [<] toggle │  content                │  ← toggle chevron in header row
 * ├────────────┤                         │
 * │ [Home]     │                         │
 * │ ─────────  │                         │
 * │ > ZONES    │                         │
 * │   All Zon. │                         │
 * │   Zone A   │                         │
 * │ > REALMS   │                         │
 * │   Realm A  │                         │
 * ├────────────┤                         │
 * │ [children] │                         │
 * └────────────┴─────────────────────────┘
 *  ←-- 280px -->
 * ```
 *
 * ---
 *
 * **Desktop  (961 px – 1535 px)** — `mode="inline"`, open by default
 * 桌面端：内嵌模式，默认展开，侧边栏通过占据 280 px 宽度推开内容区。
 *
 * ```
 * ┌────────────┬─────────────────────────┐
 * │ Header                               │
 * ├────────────┼─────────────────────────┤
 * │            │                         │
 * │ [<] toggle │  main content           │
 * ├────────────┤                         │  ← inline: sidebar width reserved
 * │ [Home]     │                         │    by spacer div; content shifts
 * │ ─────────  │                         │
 * │ > ZONES  ^ │                         │  ← ^ = ChevronUp (section open)
 * │   All Zon. │                         │
 * │   Zone A   │                         │
 * │   Zone B   │                         │
 * │ > REALMS ^ │                         │
 * │   All Rea. │                         │
 * │   Realm A  │                         │
 * ├────────────┤                         │
 * │ [children] │                         │  ← flex-1 scrollable slot
 * └────────────┴─────────────────────────┘
 *  ←-- 280px -->
 * ```
 *
 * ---
 *
 * **Ultra-wide  (≥1536 px)** — `mode="inline"`, open by default, same 280 px width
 * 超宽屏：与桌面端相同的 280 px 内嵌侧边栏，内容区获得更多剩余空间。
 *
 * ```
 * ┌────────────┬────────────────────────────────────────────────┐
 * │ Header                                                       │
 * ├────────────┼────────────────────────────────────────────────┤
 * │            │                                                 │
 * │ [<] toggle │  wide content area (flex-1, min-w-0)           │
 * ├────────────┤                                                 │
 * │ [Home]     │                                                 │
 * │ ─────────  │                                                 │
 * │ > ZONES  ^ │                                                 │
 * │   All Zon. │                                                 │
 * │   Zone A   │                                                 │
 * │ > REALMS ^ │                                                 │
 * │   Realm A  │                                                 │
 * ├────────────┤                                                 │
 * │ [children] │                                                 │
 * └────────────┴────────────────────────────────────────────────┘
 *  ←-- 280px -->     ←------- remaining viewport ---------------→
 *
 * Note: drawerWidth (280 px default) is the same across all non-mobile
 * breakpoints; the sidebar does not automatically widen at ≥1536 px —
 * the extra space accrues entirely to the content area.
 * 注意：drawerWidth 默认 280 px，在所有非移动端断点下保持不变；
 * ≥1536 px 时侧边栏不会自动变宽，额外空间全部归入内容区。
 * ```
 *
 * ---
 *
 * Narrow/wide edge handling / 窄宽边界处理：
 *
 * - Nav items truncate with `truncate` (single-line ellipsis); no wrapping.
 * - `onlyMobile` items are filtered out when `isMobile` is false.
 * - Section headers are collapsible (`collapsible: true`) with ChevronUp/Down
 *   toggle; state lives in `layoutStore.openItems` keyed by section id.
 * - The children slot (zones/realms lists from subscriptions in MainLayout)
 *   occupies `flex-1 min-h-0`; it scrolls independently of the nav header.
 * - `layoutType="type-b"` (default): a small spacer (`mt-2`) between the
 *   toggle header and the nav list. `type-a` renders a `<Separator />` instead.
 */
interface SidebarProps {
  sidebarClassName?: string;
  sidebarHeaderClassName?: string;
  NAVIGATION: NavigationItem[];
  children?: ReactNode;
  isDragging?: boolean;
  layoutType?: "type-a" | "type-b";
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarClassName,
  sidebarHeaderClassName,
  NAVIGATION,
  children = null,
  isDragging = false,
  layoutType = "type-b",
}) => {
  const isMobile = useIsMobile();
  const sidebarOpen = useLayoutStore((s) => s.sidebarOpen);
  const sidebarWidth = useLayoutStore((s) => s.drawerWidth);
  const handleDrawerToggle = useLayoutStore((s) => s.toggleSidebar);
  const closeSidebar = useLayoutStore((s) => s.closeSidebar);
  const { toggleItem, openItems } = useLayoutStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const handleSidebarClose = () => {
    if (isMobile) {
      closeSidebar();
    }
  };

  const hasChildren =
    children !== null && children !== undefined && children !== false;

  const handleItemClick = (
    _event: any,
    segment: string | undefined,
    hasChildren: boolean,
    defaultOpen = false,
  ) => {
    // console.log("handleItemClick", event);
    if (!segment) return;
    if (hasChildren) {
      toggleItem(segment, defaultOpen);
    } else {
      // setLocation(`${segment}`);
      if (isMobile) {
        handleSidebarClose();
      }
    }
  };

  const sidebarInner = (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("shrink-0", sidebarHeaderClassName)}>
        <MainSidebarMenuSection
          handleDrawerToggle={handleDrawerToggle}
          handleItemClick={handleItemClick}
          layoutType={layoutType}
          NAVIGATION={NAVIGATION}
          isMobile={isMobile}
          pathname={pathname}
          openItems={openItems}
        />
      </div>
      {hasChildren ? <div className="min-h-0 flex-1">{children}</div> : null}
    </div>
  );

  // Desktop: simple flex-based sidebar that pushes content by taking width.
  // 桌面端：基于 flex 的简单侧边栏，通过占据宽度来推开内容。
  return (
    <UiSidebar
      isOpen={sidebarOpen}
      onClose={handleSidebarClose}
      mode={isMobile ? "fixed" : "inline"}
      width={`${sidebarWidth}px`}
      className={cn(sidebarClassName, "rounded-lg overflow-hidden")}
      isDragging={isDragging}
    >
      {sidebarInner}
    </UiSidebar>
  );
};
