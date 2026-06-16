import { useTranslation } from "@rezics/i18n/react";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useRealmDetail } from "../pages/realmDetailContext";

// Realm detail tab routes. "feed" is the index route (empty path suffix); the
// others are sibling sub-routes under the realm detail layout.
// realm 详情标签路由。"feed" 为索引路由（路径后缀为空）；其余为详情布局下的
// 同级子路由。
const TAB_PATHS = {
  feed: "",
  wiki: "/wiki",
  tags: "/tags",
  about: "/about",
  members: "/members",
} as const;
type RealmTabKey = keyof typeof TAB_PATHS;

/**
 * Tab navigation shell for realm detail. Renders the tab bar as route links and
 * the active tab's routed content as children — mirroring the book detail and
 * profile shells so the realm detail experience matches its family.
 * realm 详情的标签导航壳层。将标签栏渲染为路由链接，并把当前标签的路由内容作为
 * children 渲染——与书籍详情、个人主页壳层一致，使 realm 详情体验与同家族对齐。
 */
export function RealmDetailShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation(["common", "entity"]);
  const { realmId, showWikiTab } = useRealmDetail();
  const navigate = useNavigate();
  const activeTab = useActiveTab(realmId);

  const handleTabChange = (value: string) => {
    navigate({
      to: `/realm/$realmId${TAB_PATHS[value as RealmTabKey]}`,
      params: { realmId },
    });
  };

  return (
    <div>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-4">
        <TabsList>
          <TabsTrigger value="feed">{t("entity:realm_tab_feed")}</TabsTrigger>
          {showWikiTab && <TabsTrigger value="wiki">Wiki</TabsTrigger>}
          <TabsTrigger value="tags">{t("entity:realm_tab_tags")}</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="members">
            {t("entity:realm_tab_members")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div>{children}</div>
    </div>
  );
}

function useActiveTab(realmId: string): RealmTabKey {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/realm/${realmId}`;
  const match = (Object.keys(TAB_PATHS) as RealmTabKey[]).find(
    (key) => key !== "feed" && pathname.startsWith(`${base}${TAB_PATHS[key]}`),
  );
  return match ?? "feed";
}
