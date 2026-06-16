import { createFileRoute } from "@tanstack/react-router";
import {
  normalizeRealmCreateMode,
  type RealmCreateMode,
  RealmCreatePage,
} from "@/realm";

type RealmCreateSearch = {
  mode?: RealmCreateMode;
};

export const Route = createFileRoute("/_mainLayout/realm/$realmId/create")({
  validateSearch: (search: Record<string, unknown>): RealmCreateSearch => ({
    mode: normalizeRealmCreateMode(search.mode),
  }),
  component: () => {
    const { realmId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();

    return (
      <RealmCreatePage
        realmId={realmId}
        mode={search.mode}
        onModeChange={(mode) =>
          navigate({ search: (prev) => ({ ...prev, mode }) })
        }
      />
    );
  },
});
