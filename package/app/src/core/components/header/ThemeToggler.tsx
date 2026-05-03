import { DropdownMenuItem } from "@rezics/ui/shadcn";
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
    <DropdownMenuItem onClick={toggleTheme}>
      {isDark ? (
        <Brightness7Icon className="w-4 h-4" />
      ) : (
        <Brightness4Icon className="w-4 h-4" />
      )}
      <span>Toggle theme</span>
    </DropdownMenuItem>
  );
}
