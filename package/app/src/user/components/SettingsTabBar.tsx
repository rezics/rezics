import { Tab, Tabs } from "@mui/material";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { FC } from "react";
import { SETTINGS_NAV } from "./SettingsSidebar";

export const SettingsTabBar: FC = () => {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const pathname = location.pathname;

  const activeIdx = SETTINGS_NAV.findIndex((nav) =>
    pathname.startsWith(`/user/me/setting/${nav.path}`),
  );

  return (
    <Tabs
      value={activeIdx === -1 ? 0 : activeIdx}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      sx={{ borderBottom: 1, borderColor: "divider" }}
      onChange={(_e, idx) => {
        const nav = SETTINGS_NAV[idx];
        void navigate({ to: `/user/me/setting/${nav.path}` });
      }}
    >
      {SETTINGS_NAV.map((nav) => (
        <Tab key={nav.path} label={nav.label} />
      ))}
    </Tabs>
  );
};
