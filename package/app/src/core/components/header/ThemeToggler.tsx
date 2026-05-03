import { ListItemIcon, ListItemText, MenuItem } from "@mui/material";
import { useMemo } from "react";
import { useAppStore } from "@/app/states/appStore";
import { Moon as Brightness4Icon, Sun as Brightness7Icon } from "lucide-react";

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
