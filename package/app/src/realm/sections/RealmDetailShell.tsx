import { useTranslation } from "@rezics/i18n/react";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  realmDetailHref,
  type RealmDetailRouteLocation,
  type RealmDetailTab,
} from "../models/realmDetailRoutes";
import { useRealmDetail } from "../pages/realmDetailContext";

// Realm detail tab routes. "stream" is the index route; Dock is a small-screen
// tab because large screens render the main Dock as a side rail.
// realm 详情标签路由。"stream" 为索引路由；Dock 只作为小屏标签，大屏会将
// main Dock 渲染为侧边停靠区。
const REALM_TABS = ["stream", "wiki", "tags", "rules", "dock"] as const;

/**
 * Tab navigation shell for realm detail. Renders the tab bar as route links and
 * the active tab's routed content as children — mirroring the book detail and
 * profile shells so the realm detail experience matches its family.
 * realm 详情的标签导航壳层。将标签栏渲染为路由链接，并把当前标签的路由内容作为
 * children 渲染——与书籍详情、个人主页壳层一致，使 realm 详情体验与同家族对齐。
 */
export function RealmDetailShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation(["common", "entity"]);
  const { routeLocation } = useRealmDetail();
  const navigate = useNavigate();
  const activeTab = useActiveTab(routeLocation);

  const handleTabChange = (value: string) => {
    navigate({
      to: realmDetailHref(routeLocation, value as RealmDetailTab),
    });
  };

  return (
    <div>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-4">
        <TabsList>
          <TabsTrigger value="stream">
            {t("entity:realm_tab_stream")}
          </TabsTrigger>
          <TabsTrigger value="wiki">{t("entity:realm_tab_wiki")}</TabsTrigger>
          <TabsTrigger value="tags">{t("entity:realm_tab_tags")}</TabsTrigger>
          <TabsTrigger value="rules">{t("entity:realm_tab_rules")}</TabsTrigger>
          <TabsTrigger value="dock" className="lg:hidden">
            {t("entity:realm_tab_dock")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div>{children}</div>
    </div>
  );
}

function useActiveTab(routeLocation: RealmDetailRouteLocation): RealmDetailTab {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const match = REALM_TABS.find(
    (key) =>
      key !== "stream" &&
      pathname.startsWith(realmDetailHref(routeLocation, key)),
  );
  return match ?? "stream";
}
