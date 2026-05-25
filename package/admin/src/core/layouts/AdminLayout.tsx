import { Button, Sheet, SheetContent } from "@rezics/ui/shadcn";
import { Menu as MenuIcon } from "lucide-react";
import React from "react";
import { AdminNav } from "@/navigation/AdminNav";
import { adminNav } from "@/navigation/adminNavConfig";
import { useMessage } from "@rezics/i18n/react";
import {
  admin_layout_open_menu,
  admin_layout_title,
} from "@rezics/i18n/messages";
const m = {
  admin_layout_open_menu,
  admin_layout_title,
};

const i18nMessages = {
  admin_layout_open_menu,
  admin_layout_title,
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const m = useMessage(i18nMessages);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const drawerWidth = adminNav.drawerWidth;

  const drawer = (
    <AdminNav items={adminNav.items} onNavigate={() => setMobileOpen(false)} />
  );

  return (
    <div className="flex min-h-screen bg-surface-canvas">
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border-whisper bg-surface-canvas">
        <div className="flex items-center gap-2 px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.admin_layout_open_menu()}
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </Button>
          <h2 className="text-lg font-bold">{m.admin_layout_title()}</h2>
          <div className="flex-1" />
        </div>
      </header>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="md:hidden p-0"
          style={{ width: drawerWidth }}
        >
          {drawer}
        </SheetContent>
      </Sheet>

      {/* Desktop permanent sidebar — reserves space via flex shrink-0 */}
      <div
        className="hidden md:block shrink-0"
        style={{ width: drawerWidth }}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-border-whisper bg-surface-canvas md:block"
        style={{ width: drawerWidth }}
      >
        {drawer}
      </aside>

      <main className="flex-1 min-w-0 px-4 md:px-6 pb-6 pt-16">{children}</main>
    </div>
  );
}
