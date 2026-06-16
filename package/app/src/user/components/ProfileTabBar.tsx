import { getI18nRuntime } from "@rezics/i18n/runtime";

const i18nMessages = {
  profile_tab_overview: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_overview"),
  profile_tab_content: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_content"),
  profile_tab_shelves: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_shelves"),
  profile_tab_followers: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_followers"),
  profile_tab_reactions: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_reactions"),
  profile_tab_activity: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_activity"),
  profile_tab_progress: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_progress"),
} as const;

import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { FC } from "react";
import { profileTabPaths } from "@/user/models/profileTabs";

interface ProfileTabBarProps {
  isCurrentUser?: boolean;
  profileBasePath: string;
}

const PROFILE_TAB_BY_PATH = {
  "": { label: i18nMessages.profile_tab_overview, path: "" },
  "/content": { label: i18nMessages.profile_tab_content, path: "/content" },
  "/shelves": { label: i18nMessages.profile_tab_shelves, path: "/shelves" },
  "/followers": {
    label: i18nMessages.profile_tab_followers,
    path: "/followers",
  },
  "/reactions": {
    label: i18nMessages.profile_tab_reactions,
    path: "/reactions",
  },
  "/activity": { label: i18nMessages.profile_tab_activity, path: "/activity" },
  "/progress": { label: i18nMessages.profile_tab_progress, path: "/progress" },
} as const;

export const ProfileTabBar: FC<ProfileTabBarProps> = ({
  isCurrentUser = false,
  profileBasePath,
}) => {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const tabs = profileTabPaths(isCurrentUser).map(
    (path) => PROFILE_TAB_BY_PATH[path as keyof typeof PROFILE_TAB_BY_PATH],
  );
  const activeTab =
    tabs.find((tab, i) => {
      if (i === 0) {
        return (
          pathname === profileBasePath || pathname === `${profileBasePath}/`
        );
      }
      return pathname.startsWith(`${profileBasePath}${tab.path}`);
    }) ?? tabs[0];

  return (
    <div className="border-b border-border-whisper">
      <Tabs
        value={activeTab.path}
        className="min-w-0 max-w-full"
        onValueChange={(value) => {
          void navigate({ to: `${profileBasePath}${value}` });
        }}
      >
        <TabsList className="w-full max-w-full justify-start overflow-x-auto overscroll-x-contain bg-transparent">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.path} value={tab.path} className="flex-none">
              {tab.label()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};
