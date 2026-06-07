import { createFileRoute } from "@tanstack/react-router";
import { RealmManagePage } from "@/realm/pages/RealmManagePage";

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

export const Route = createFileRoute("/_mainLayout/realm/$realmId/manage")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: RealmManageTab } => ({
    tab: isRealmManageTab(search.tab) ? search.tab : undefined,
  }),
  component: RealmManageRoute,
});

function RealmManageRoute() {
  const { realmId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <RealmManagePage
      realmId={realmId}
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
