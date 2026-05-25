import { DropdownMenuItem } from "@rezics/ui/shadcn";
import { Moon as Brightness4Icon, Sun as Brightness7Icon } from "lucide-react";
import { useMemo } from "react";
import { useAppStore } from "@/app/states/appStore";
import { useMessage } from "@rezics/i18n/react";
import { app_toggle_theme } from "@rezics/i18n/messages";
const m = {
  app_toggle_theme,
};

const i18nMessages = {
  app_toggle_theme,
};

export function ThemeToggler() {
  const m = useMessage(i18nMessages);
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
      <span>{m.app_toggle_theme()}</span>
    </DropdownMenuItem>
  );
}
