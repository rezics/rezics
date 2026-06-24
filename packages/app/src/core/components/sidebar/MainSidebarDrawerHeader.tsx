import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MainSidebarDrawerHeader({
  handleDrawerToggle,
}: {
  handleDrawerToggle: () => void;
}) {
  const { t } = useTranslation(["shell"]);
  // Direction is fixed to LTR by default; document.dir handled at <html>.
  // 方向默认固定为 LTR；document.dir 在 <html> 处理。
  const isLtr = typeof document !== "undefined" ? document.dir !== "rtl" : true;

  return (
    <div className="flex items-center px-2 min-h-16 justify-end">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("shell:app_toggle_drawer_aria_label")}
        onClick={handleDrawerToggle}
      >
        {isLtr ? <ChevronLeft /> : <ChevronRight />}
      </Button>
    </div>
  );
}
