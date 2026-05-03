import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { FC } from "react";
import { SETTINGS_NAV } from "./SettingsSidebar";

export const SettingsTabBar: FC = () => {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const pathname = location.pathname;

  const activeNav =
    SETTINGS_NAV.find((nav) =>
      pathname.startsWith(`/user/me/setting/${nav.path}`),
    ) ?? SETTINGS_NAV[0];

  return (
    <div className="border-b border-rezics-color-border overflow-x-auto">
      <Tabs
        value={activeNav.path}
        onValueChange={(value) => {
          void navigate({ to: `/user/me/setting/${value}` });
        }}
      >
        <TabsList className="bg-transparent">
          {SETTINGS_NAV.map((nav) => (
            <TabsTrigger key={nav.path} value={nav.path}>
              {nav.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};
