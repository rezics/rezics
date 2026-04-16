import { Tab, Tabs } from "@mui/material";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { FC } from "react";

const PROFILE_TABS = [
  { label: "Overview", path: "" },
  { label: "Content", path: "/content" },
  { label: "Shelves", path: "/shelves" },
  { label: "Realms", path: "/realms" },
  { label: "Followers", path: "/followers" },
  { label: "Reactions", path: "/reactions" },
] as const;

interface ProfileTabBarProps {
  unitId: string;
}

export const ProfileTabBar: FC<ProfileTabBarProps> = ({ unitId }) => {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const basePath = `/user/${unitId}`;

  const activeIdx = PROFILE_TABS.findIndex((tab, i) => {
    if (i === 0) {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(`${basePath}${tab.path}`);
  });

  return (
    <Tabs
      value={activeIdx === -1 ? 0 : activeIdx}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      sx={{ borderBottom: 1, borderColor: "divider" }}
      onChange={(_e, idx) => {
        const tab = PROFILE_TABS[idx];
        void navigate({ to: `/user/$unitId${tab.path}`, params: { unitId } });
      }}
    >
      {PROFILE_TABS.map((tab) => (
        <Tab key={tab.path} label={tab.label} />
      ))}
    </Tabs>
  );
};
