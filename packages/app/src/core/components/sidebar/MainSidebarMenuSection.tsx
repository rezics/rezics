import { Separator } from "@rezics/ui/shadcn";
import { NavigationList } from "../navigation/NavigationList";
import type { NavigationItem } from "../navigation/navigation";
import { MainSidebarDrawerHeader } from "./MainSidebarDrawerHeader";

interface MainSidebarMenuSectionProps {
  handleDrawerToggle: () => void;
  handleItemClick: (
    event: any,
    segment: string | undefined,
    hasChildren: boolean,
    defaultOpen?: boolean,
  ) => void;
  layoutType: "type-a" | "type-b";
  NAVIGATION: NavigationItem[];
  isMobile: boolean;
  pathname: string;
  openItems: Record<string, boolean>;
}

/**
 * 主侧栏菜单部分。渲染导航列表和抽屉标题，根据布局类型应用分隔符。
 * Main sidebar menu section. Renders navigation list and drawer header, applies separator per layout type.
 *
 * Mobile (Drawer):   Tablet (Sidebar):    Desktop (Sidebar):  Ultra-wide (Sidebar):
 * ┌──────────────┐   ┌────────┐           ┌────────┐           ┌────────┐
 * │ [≡] Close    │   │ [≡]    │           │ [≡]    │           │ [≡]    │
 * │ ─────────────│   │ ──────│           │ ──────│           │ ──────│
 * │ Home         │   │ Home   │           │ Home   │           │ Home   │
 * │ Browse       │   │ Browse │           │ Browse │           │ Browse │
 * │ › Shelves    │   │ › Shel │           │ › Shel │           │ › Shel │
 * │ Messages     │   │ Msgs   │           │ Msgs   │           │ Msgs   │
 * └──────────────┘   └────────┘           └────────┘           └────────┘
 */
export function MainSidebarMenuSection({
  handleDrawerToggle,
  handleItemClick,
  layoutType,
  NAVIGATION,
  isMobile,
  pathname,
  openItems,
}: MainSidebarMenuSectionProps) {
  return (
    <div>
      <MainSidebarDrawerHeader handleDrawerToggle={handleDrawerToggle} />
      {layoutType === "type-a" && <Separator />}
      {layoutType === "type-b" && <div className="mt-2" />}
      <NavigationList
        NAVIGATION={NAVIGATION}
        isMobile={isMobile}
        pathname={pathname}
        openItems={openItems}
        handleItemClick={handleItemClick}
      />
    </div>
  );
}
