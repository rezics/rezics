import { IconButton } from "@mui/material";
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
  return (
    <IconButton
      aria-label={t("accessibility.open_drawer")}
      onClick={handleDrawerToggleInner}
      sx={{
        display:
          layoutType === "type-b" ? "flex" : sidebarOpen ? "none" : "flex",
      }}
    >
      <Menu />
    </IconButton>
  );
};
