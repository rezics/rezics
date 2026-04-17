import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { ListItemIcon, ListItemText, MenuItem } from "@mui/material";
import { useMemo } from "react";
import { useAppStore } from "@/app/states/appStore";

export function ThemeToggler() {
  const themeMode = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  const toggleTheme = () => {
    setTheme(themeMode === "light" ? "dark" : "light");
  };

  const isDark = useMemo(() => themeMode === "dark", [themeMode]);

  return (
    <MenuItem onClick={toggleTheme}>
      <ListItemIcon>
        {isDark ? (
          <Brightness7Icon fontSize="small" />
        ) : (
          <Brightness4Icon fontSize="small" />
        )}
      </ListItemIcon>
      <ListItemText>Toggle theme</ListItemText>
    </MenuItem>
  );
}
