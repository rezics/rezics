import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
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
  userId: string;
  userSlug?: string;
}

export const ProfileTabBar: FC<ProfileTabBarProps> = ({ userId, userSlug }) => {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const isSlugRoute = userSlug ? pathname.startsWith(`/u/${userSlug}`) : false;
  const basePath =
    isSlugRoute && userSlug ? `/u/${userSlug}` : `/user/${userId}`;

  const activeTab =
    PROFILE_TABS.find((tab, i) => {
      if (i === 0) {
        return pathname === basePath || pathname === `${basePath}/`;
      }
      return pathname.startsWith(`${basePath}${tab.path}`);
    }) ?? PROFILE_TABS[0];

  return (
    <div className="border-b border-border-whisper overflow-x-auto">
      <Tabs
        value={activeTab.path}
        onValueChange={(value) => {
          if (isSlugRoute && userSlug && value === "") {
            void navigate({
              to: "/u/$userSlug",
              params: { userSlug },
            });
            return;
          }

          void navigate({
            to: `/user/$userId${value}`,
            params: { userId },
          });
        }}
      >
        <TabsList className="bg-transparent">
          {PROFILE_TABS.map((tab) => (
            <TabsTrigger key={tab.path} value={tab.path}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};
