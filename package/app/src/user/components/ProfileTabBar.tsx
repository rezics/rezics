import { unitHref } from "@rezics/ui/primitive/link";
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
    <div className="border-b border-border-whisper">
      <Tabs
        value={activeTab.path}
        className="min-w-0 max-w-full"
        onValueChange={(value) => {
          if (value === "") {
            void navigate({
              to: unitHref({
                type: "USER",
                unitId: userId,
                slug: userSlug ?? null,
              }),
            });
            return;
          }

          void navigate({
            to: `/user/$userId${value}`,
            params: { userId },
          });
        }}
      >
        <TabsList className="w-full max-w-full justify-start overflow-x-auto overscroll-x-contain bg-transparent">
          {PROFILE_TABS.map((tab) => (
            <TabsTrigger key={tab.path} value={tab.path} className="flex-none">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};
