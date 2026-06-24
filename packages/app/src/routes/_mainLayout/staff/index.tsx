import { createFileRoute } from "@tanstack/react-router";
import { StaffConsolePage } from "@/staff";

type StaffConsoleSearch = {
  realmUnitId?: string;
  accountUserId?: string;
};

export const Route = createFileRoute("/_mainLayout/staff/")({
  validateSearch: (search: Record<string, unknown>): StaffConsoleSearch => ({
    realmUnitId:
      typeof search.realmUnitId === "string" ? search.realmUnitId : undefined,
    accountUserId:
      typeof search.accountUserId === "string"
        ? search.accountUserId
        : undefined,
  }),
  component: StaffConsoleRoute,
});

function StaffConsoleRoute() {
  const search = Route.useSearch();
  return (
    <StaffConsolePage
      initialRealmUnitId={search.realmUnitId}
      initialAccountUserId={search.accountUserId}
    />
  );
}
