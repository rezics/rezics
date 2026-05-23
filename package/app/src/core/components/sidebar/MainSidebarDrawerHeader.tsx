import { Button } from "@rezics/ui/shadcn";
import * as m from "@rezics/i18n/messages";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MainSidebarDrawerHeader({
  handleDrawerToggle,
}: {
  handleDrawerToggle: () => void;
}) {
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
