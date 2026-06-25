import { realmDetailQuery } from "@rezics/contract/api/realm/realm.queries";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { routeQueryOrNotFound } from "@/core";
import {
  normalizeRealmCreateMode,
  type RealmCreateMode,
  RealmCreatePage,
} from "@/realm";
import { isRealmUnitIdParam } from "@/realm/models/realmDetailRoutes";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

type RealmCreateSearch = {
  mode?: RealmCreateMode;
};

export const Route = createFileRoute("/_mainLayout/realm/$realmId/create")({
  loader: async ({ params, context }) => {
    if (!isRealmUnitIdParam(params.realmId)) throw notFound();
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    await routeQueryOrNotFound(
      context.qc,
      realmDetailQuery(params.realmId, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
    );
  },
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
