import { Outlet } from "@tanstack/react-router";
import type { FC } from "react";
import { SettingsSidebar } from "./SettingsSidebar";
import { SettingsTabBar } from "./SettingsTabBar";
import { useMessage } from "@rezics/i18n/react";
import { settings_title } from "@rezics/i18n/messages";
const i18nMessages = {
  settings_title,
};

export const SettingsShell: FC = () => {
  const m = useMessage(i18nMessages);
  return (
    <div className="w-full max-w-6xl mx-auto pb-12">
      <h5 className="text-xl font-semibold px-4 pt-8 pb-4">
        {m.settings_title()}
      </h5>

      {/* Mobile: horizontal tabs */}
      <div className="md:hidden">
        <SettingsTabBar />
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex flex-col md:flex-row md:gap-12 px-4 pt-4">
        <aside className="hidden md:block w-[220px] shrink-0">
          <SettingsSidebar />
        </aside>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
