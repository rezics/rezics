import { unitHref } from "@/shared/ui/link";
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
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};
