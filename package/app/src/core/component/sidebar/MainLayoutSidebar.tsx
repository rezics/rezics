import { useRouterState } from "@tanstack/react-router";
import type React from "react";
import type { ReactNode } from "react";
import useMeasure from "react-use-measure";
import { cn } from "@/shared/util/css-util";
import { useIsMobile } from "@/shared/util/use-media-query";
import { useLayoutStore } from "../../state/layoutStore";
import type { NavigationItem } from "../navigation/navigation";
import { MainSidebarMenuSection } from "./MainSidebarMenuSection";
import { Sidebar as UiSidebar } from "./sidebar";

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
  const [refAbove, { height }] = useMeasure();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const handleSidebarClose = () => {
    if (isMobile) {
      closeSidebar();
    }
  };

  // All hooks must run unconditionally and in the same order every render.
  const heightBelow = `calc(100vh - ${height}px)`;

  const handleItemClick = (
    // @ts-expect-error - event is not used
    _event: any,
    segment: string | undefined,
    hasChildren: boolean,
  ) => {
    // console.log("handleItemClick", event);
    if (!segment) return;
    if (hasChildren) {
      toggleItem(segment);
    } else {
      // setLocation(`${segment}`);
      if (isMobile) {
        handleSidebarClose();
      }
    }
  };

  const sidebarInner = (
    <>
      <div ref={refAbove} className={sidebarHeaderClassName}>
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
      <div style={{ height: heightBelow }}>{children}</div>
    </>
  );

  // Desktop: simple flex-based sidebar that pushes content by taking width.
  return (
    <UiSidebar
      isOpen={sidebarOpen}
      onClose={handleSidebarClose}
      mode={isMobile ? "fixed" : "inline"}
      width={`${sidebarWidth}px`}
      className={cn(sidebarClassName, "rounded-lg overflow-auto")}
      isDragging={isDragging}
    >
      {sidebarInner}
    </UiSidebar>
  );
};
