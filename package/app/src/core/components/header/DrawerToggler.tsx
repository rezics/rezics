import { Button } from "@rezics/ui/shadcn";
import { Menu } from "lucide-react";
import { useMessage } from "@rezics/i18n/react";
import { accessibility_open_drawer } from "@rezics/i18n/messages";
const i18nMessages = {
  accessibility_open_drawer,
};

interface DrawerTogglerProps {
  handleDrawerToggleInner: () => void;
  layoutType: "type-a" | "type-b";
  sidebarOpen: boolean;
}

export const DrawerToggler = ({
  handleDrawerToggleInner,
  layoutType,
  sidebarOpen,
}: DrawerTogglerProps) => {
  const m = useMessage(i18nMessages);
  const hidden = layoutType === "type-a" && sidebarOpen;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={m.accessibility_open_drawer()}
      onClick={handleDrawerToggleInner}
      className={
        hidden ? "hidden" : "flex h-10 min-w-10 rounded-full bg-transparent"
      }
    >
      <Menu className="w-5 h-5" />
    </Button>
  );
};
