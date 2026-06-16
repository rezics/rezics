import { realmBySlugQuery } from "@rezics/api/realm/realm";
import { isPublicRealmSlugRouteParams, type RealmDTO } from "@rezics/contract";
import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

export async function loadRealmSlugRoute(input: {
  params: unknown;
  queryClient: QueryClient;
}): Promise<{ realm: RealmDTO }> {
  if (!isPublicRealmSlugRouteParams(input.params)) throw notFound();
  const { realmSlug } = input.params;
  const realm = await input.queryClient
    .ensureQueryData(realmBySlugQuery(realmSlug))
    .catch(() => {
      throw notFound();
    });
  return { realm };
}
