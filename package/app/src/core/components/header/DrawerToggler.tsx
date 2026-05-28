import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { Menu } from "lucide-react";

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
  const { t } = useTranslation(["common"]);
const hidden = layoutType === "type-a" && sidebarOpen;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("common:accessibility_open_drawer")}
      onClick={handleDrawerToggleInner}
      className={
        hidden ? "hidden" : "flex h-10 min-w-10 rounded-full bg-transparent"
      }
    >
      <Menu className="w-5 h-5" />
    </Button>
  );
};
