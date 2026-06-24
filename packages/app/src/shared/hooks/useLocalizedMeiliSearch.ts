import { federatedSearchQueryOptions } from "@rezics/contract/api/meili/meili.federated";
import {
  contentSearchQueryOptions,
  pollSearchQueryOptions,
  postSearchQueryOptions,
  realmSearchQueryOptions,
} from "@rezics/contract/api/meili/meili.queries";
import type {
  ContentSearchOptions,
  FederatedSearchOptions,
  PollSearchOptions,
  PostSearchOptions,
  RealmSearchOptions,
} from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useReadLanguageContext } from "./useReadLanguageCandidates";

function useLocalizedOptions<T extends object>(opts: T) {
  const readContext = useReadLanguageContext();
  const localized = useMemo(
    () => ({
      ...opts,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    [opts, readContext],
  );
  return { localized, ready: readContext.ready };
}

export function useLocalizedContentSearch(opts: ContentSearchOptions) {
  const { localized, ready } = useLocalizedOptions(opts);
  return useQuery({
    ...contentSearchQueryOptions(localized),
    enabled: ready,
  });
}

export function useLocalizedPostSearch(opts: PostSearchOptions) {
  const { localized, ready } = useLocalizedOptions(opts);
  return useQuery({
    ...postSearchQueryOptions(localized),
    enabled: ready,
  });
}

export function useLocalizedPollSearch(opts: PollSearchOptions) {
  const { localized, ready } = useLocalizedOptions(opts);
  return useQuery({
    ...pollSearchQueryOptions(localized),
    enabled: ready,
  });
}

export function useLocalizedRealmSearch(opts: RealmSearchOptions) {
  const { localized, ready } = useLocalizedOptions(opts);
  return useQuery({
    ...realmSearchQueryOptions(localized),
    enabled: ready,
  });
}

export function useLocalizedFederatedSearch(opts: FederatedSearchOptions) {
  const { localized, ready } = useLocalizedOptions(opts.query);
  return useQuery({
    ...federatedSearchQueryOptions({ ...opts, query: localized }),
    enabled: ready,
  });
}
