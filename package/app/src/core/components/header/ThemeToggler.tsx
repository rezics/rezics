import { useTranslation } from "@rezics/i18n/react";
import { DropdownMenuItem } from "@rezics/ui/shadcn";
import { Moon as Brightness4Icon, Sun as Brightness7Icon } from "lucide-react";
import { useMemo } from "react";
import { useAppStore } from "@/app/states/appStore";

export function ThemeToggler() {
  const { t } = useTranslation(["shell"]);
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
      <span>{t("shell:app_toggle_theme")}</span>
    </DropdownMenuItem>
  );
}
