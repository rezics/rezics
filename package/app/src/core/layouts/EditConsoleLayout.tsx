import { Separator } from "@rezics/ui/shadcn";
import type React from "react";
import type { ReactNode } from "react";
import { Header } from "@/core/components/header/MainLayoutHeader.tsx";
import { Sidebar } from "@/core/components/sidebar/MainLayoutSidebar.tsx";
import { cn } from "@/shared/utils/css-util";
import type {
  NavigationIcon,
  NavigationItem,
} from "../components/navigation/navigation";

export interface EditConsoleNavigationItem {
  label: string;
  href: string;
  icon?: NavigationIcon;
  activeMatch?: "exact" | "prefix";
  isActive?: (pathname: string) => boolean;
}

export interface EditConsoleLayoutProps {
  returnItem: EditConsoleNavigationItem;
  primaryItems: EditConsoleNavigationItem[];
  operationalItems?: EditConsoleNavigationItem[];
  contextSlot?: ReactNode;
  children: ReactNode;
  sidebarId?: string;
  mainClassName?: string;
}

function toNavigationItem(item: EditConsoleNavigationItem): NavigationItem {
  return {
    kind: "item",
    title: item.label,
    segment: item.href,
    icon: item.icon,
    activeMatch: item.activeMatch,
    isActive: item.isActive,
  };
}

export const EditConsoleLayout: React.FC<EditConsoleLayoutProps> = ({
  returnItem,
  primaryItems,
  operationalItems = [],
  contextSlot,
  children,
  sidebarId = "edit-console-sidebar",
  mainClassName,
}) => {
  const navigation = [returnItem, ...primaryItems, ...operationalItems].map(
    toNavigationItem,
  );

  return (
    <div className="flex min-h-screen bg-surface-canvas">
      <Header />
      <div id={sidebarId}>
        <Sidebar NAVIGATION={navigation}>
          {contextSlot ? (
            <div
              className="flex h-full min-h-0 flex-col px-2"
              data-edit-console-context
            >
              <Separator className="mx-2 my-2 shrink-0" />
              <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4">
                {contextSlot}
              </div>
            </div>
          ) : null}
        </Sidebar>
      </div>

      <main
        className={cn(
          "flex-grow pt-32 transition-all duration-300",
          mainClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
};
