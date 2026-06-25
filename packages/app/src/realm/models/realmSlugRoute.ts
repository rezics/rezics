import { realmDetailQuery } from "@rezics/contract/api/realm/realm.queries";
import { realmBySlugQuery } from "@rezics/contract/api/realm/useRealmBySlug";
import { isPublicRealmSlugRouteParams, type RealmDTO } from "@rezics/contract";
import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import {
  type ResolvedReadLanguageContext,
  resolveRouteReadLanguageContext,
} from "../../shared/models/readLanguageContext";

export async function loadRealmSlugRoute(input: {
  params: unknown;
  queryClient: QueryClient;
}): Promise<{ realm: RealmDTO; readContext: ResolvedReadLanguageContext }> {
  if (!isPublicRealmSlugRouteParams(input.params)) throw notFound();
  const { realmSlug } = input.params;
  const readContext = await resolveRouteReadLanguageContext(input.queryClient);
  const slugRealm = await input.queryClient
    .ensureQueryData(realmBySlugQuery(realmSlug))
    .catch(() => {
      throw notFound();
    });
  const realm = await input.queryClient
    .ensureQueryData(
      realmDetailQuery(slugRealm.unitId, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
    )
    .catch(() => slugRealm);
  return { realm, readContext };
}
