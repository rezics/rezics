import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RealmDetailLayout } from "@/realm";

// Pathless layout for the realm detail tabs. Wraps only the feed/wiki/tags/
// about/members sub-routes; the `manage`/`create`/`search`/`post` siblings stay
// outside the detail chrome.
// realm 详情标签的无路径布局。仅包裹信息流/wiki/标签/关于/成员子路由；
// `manage`/`create`/`search`/`post` 等同级路由不进入详情外壳。
export const Route = createFileRoute("/_mainLayout/realm/$realmId/_detail")({
  component: () => {
    const { realmId } = Route.useParams();
    return (
      <RealmDetailLayout realmId={realmId}>
        <Outlet />
      </RealmDetailLayout>
    );
  },
});
