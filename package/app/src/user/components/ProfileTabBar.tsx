import { getI18nRuntime } from "@rezics/i18n/runtime";

const i18nMessages = {
  profile_tab_overview: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_overview"),
  profile_tab_content: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_content"),
  profile_tab_shelves: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_shelves"),
  profile_tab_realms: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_realms"),
  profile_tab_followers: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_followers"),
  profile_tab_reactions: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_reactions"),
  profile_tab_activity: () =>
    getI18nRuntime().i18n.t("settings:profile_tab_activity"),
} as const;

import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { FC } from "react";
import { unitHref } from "@/shared/ui/link";

interface ProfileTabBarProps {
  userId: string;
  userSlug?: string;
}

const PROFILE_TABS = [
  { label: i18nMessages.profile_tab_overview, path: "" },
  { label: i18nMessages.profile_tab_content, path: "/content" },
  { label: i18nMessages.profile_tab_shelves, path: "/shelves" },
  { label: i18nMessages.profile_tab_realms, path: "/realms" },
  { label: i18nMessages.profile_tab_followers, path: "/followers" },
  { label: i18nMessages.profile_tab_reactions, path: "/reactions" },
  { label: i18nMessages.profile_tab_activity, path: "/activity" },
] as const;

export const ProfileTabBar: FC<ProfileTabBarProps> = ({ userId, userSlug }) => {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const basePath = unitHref({
    type: "USER",
    unitId: userId,
    slug: userSlug ?? null,
  });
  const activeBasePaths =
    basePath === `/user/${userId}` ? [basePath] : [basePath, `/user/${userId}`];

  const activeTab =
    PROFILE_TABS.find((tab, i) => {
      if (i === 0) {
        return activeBasePaths.some(
          (base) => pathname === base || pathname === `${base}/`,
        );
      }
      return activeBasePaths.some((base) =>
        pathname.startsWith(`${base}${tab.path}`),
      );
    }) ?? PROFILE_TABS[0];

  return (
    <div className="border-b border-border-whisper">
      <Tabs
        value={activeTab.path}
        className="min-w-0 max-w-full"
        onValueChange={(value) => {
          void navigate({ to: `${basePath}${value}` });
        }}
      >
        <TabsList className="w-full max-w-full justify-start overflow-x-auto overscroll-x-contain bg-transparent">
          {PROFILE_TABS.map((tab) => (
            <TabsTrigger key={tab.path} value={tab.path} className="flex-none">
              {tab.label()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};
