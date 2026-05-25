import { app_toggle_drawer_aria_label } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { ChevronLeft, ChevronRight } from "lucide-react";

const i18nMessages = {
  app_toggle_drawer_aria_label,
};

export function MainSidebarDrawerHeader({
  handleDrawerToggle,
}: {
  handleDrawerToggle: () => void;
}) {
  const m = useMessage(i18nMessages);
  // Direction is fixed to LTR by default; document.dir handled at <html>.
  const isLtr = typeof document !== "undefined" ? document.dir !== "rtl" : true;

  return (
    <div className="flex items-center px-2 min-h-16 justify-end">
      <Button
        variant="ghost"
        size="icon"
        aria-label={m.app_toggle_drawer_aria_label()}
        onClick={handleDrawerToggle}
      >
        {isLtr ? <ChevronLeft /> : <ChevronRight />}
      </Button>
    </div>
  );
}
