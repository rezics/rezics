import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { RealmManagePage } from "@/realm";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";

const manageTabs = [
  "profile",
  "organization",
  "wiki",
  "moderation",
  "members",
  "danger",
] as const;

type RealmManageTab = (typeof manageTabs)[number];

function isRealmManageTab(value: unknown): value is RealmManageTab {
  return typeof value === "string" && manageTabs.includes(value as never);
}

function RealmSlugManageRoute() {
  const { realm } = Route.useLoaderData();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <RealmManagePage
      realmId={realm.unitId}
      activeTab={tab ?? "profile"}
      onTabChange={(nextTab) =>
        navigate({
          search: (current) => ({ ...current, tab: nextTab }),
          replace: true,
        })
      }
    />
  );
}

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/manage")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: RealmManageTab } => ({
    tab: isRealmManageTab(search.tab) ? search.tab : undefined,
  }),
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    return loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
  },
  component: RealmSlugManageRoute,
});
