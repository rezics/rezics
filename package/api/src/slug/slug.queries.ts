import type { SlugResolvePayload } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { slugApi } from "./slug.api";
import { slugKeys } from "./slug.keys";

export const slugResolveQuery = (input: SlugResolvePayload) =>
  queryOptions({
    queryKey: slugKeys.resolve(input),
    queryFn: () => slugApi.resolve(input),
    enabled: !!input.scope && !!input.slug,
    staleTime: 1000 * 60 * 10,
  });

export const userBySlugLookupQuery = (slug: string) =>
  queryOptions({
    queryKey: slugKeys.userBySlug(slug),
    queryFn: () => slugApi.userBySlug(slug),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });

export const entityBySlugLookupQuery = (slug: string) =>
  queryOptions({
    queryKey: slugKeys.entityBySlug(slug),
    queryFn: () => slugApi.entityBySlug(slug),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });

export const shelfBySlugLookupQuery = (userSlug: string, slug: string) =>
  queryOptions({
    queryKey: slugKeys.shelfBySlug(userSlug, slug),
    queryFn: () => slugApi.shelfBySlug(userSlug, slug),
    enabled: !!userSlug && !!slug,
    staleTime: 1000 * 60 * 10,
  });

export const slugQueries = {
  resolve: slugResolveQuery,
  userBySlug: userBySlugLookupQuery,
  entityBySlug: entityBySlugLookupQuery,
  shelfBySlug: shelfBySlugLookupQuery,
};
