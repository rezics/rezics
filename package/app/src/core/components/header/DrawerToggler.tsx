import { Button } from "@rezics/ui/shadcn";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const hidden = layoutType === "type-a" && sidebarOpen;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("accessibility.open_drawer")}
      onClick={handleDrawerToggleInner}
      className={
        hidden
          ? "hidden"
          : "flex h-9 rounded-full bg-transparent"
      }
    >
      <Menu className="w-5 h-5" />
    </Button>
  );
};
