import { Button, Sheet, SheetContent } from "@rezics/ui/shadcn";
import React from "react";
import { AdminNav } from "@/navigation/AdminNav";
import { adminNav } from "@/navigation/adminNavConfig";
import { Menu as MenuIcon } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const drawerWidth = adminNav.drawerWidth;

  const drawer = (
    <AdminNav items={adminNav.items} onNavigate={() => setMobileOpen(false)} />
  );

  return (
    <div className="flex min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border-whisper bg-surface-elevated">
        <div className="flex items-center gap-2 px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </Button>
          <h2 className="text-lg font-bold">Admin</h2>
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
      <aside
        className="hidden md:block shrink-0 border-r border-border-whisper bg-surface-elevated"
        style={{ width: drawerWidth }}
      >
        {drawer}
      </aside>

      <main className="flex-1 min-w-0 px-4 md:px-6 pb-6 pt-16">{children}</main>
    </div>
  );
}
