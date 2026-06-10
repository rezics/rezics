import { createFileRoute } from "@tanstack/react-router";
import { ZoneManagePage, type ZoneManageTab } from "@/zone";

const manageTabs = [
  "profile",
  "sections",
  "menus",
  "theme",
  "lifecycle",
] as const;

function isZoneManageTab(value: unknown): value is ZoneManageTab {
  return typeof value === "string" && manageTabs.includes(value as never);
}

export const Route = createFileRoute("/_mainLayout/z/$slug/manage")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: ZoneManageTab } => ({
    tab: isZoneManageTab(search.tab) ? search.tab : undefined,
  }),
  component: ZoneSlugManageRoute,
});

function ZoneSlugManageRoute() {
  const { slug } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <ZoneManagePage
      slug={slug}
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
