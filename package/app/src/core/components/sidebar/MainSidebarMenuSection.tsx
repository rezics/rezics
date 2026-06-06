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
  ) => void;
  layoutType: "type-a" | "type-b";
  NAVIGATION: NavigationItem[];
  isMobile: boolean;
  pathname: string;
  openItems: Record<string, boolean>;
}

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
