import { queryOptions } from "@tanstack/react-query";
import { authApi } from "./auth.api";
import { authKeys } from "./auth.keys";

export const authSessionQuery = () =>
  queryOptions({
    queryKey: authKeys.session(),
    queryFn: () => authApi.getSession(),
    staleTime: 1000 * 60 * 5,
  });

export const authSessionStateQuery = () =>
  queryOptions({
    queryKey: authKeys.sessionState(),
    queryFn: () => authApi.getSessionState(),
    staleTime: 1000 * 60 * 1,
  });

export const authProvidersQuery = () =>
  queryOptions({
    queryKey: authKeys.providers(),
    queryFn: () => authApi.listProviders(),
    staleTime: 1000 * 60 * 5,
  });

export const authSessionsQuery = () =>
  queryOptions({
    queryKey: authKeys.sessions(),
    queryFn: () => authApi.listSessions(),
    staleTime: 1000 * 60 * 1,
  });

export const accountSlugAvailabilityQuery = (slug: string) =>
  queryOptions({
    queryKey: authKeys.slugAvailability(slug),
    queryFn: () => authApi.checkAccountSlug(slug),
    enabled: slug.length >= 6,
    staleTime: 1000 * 30,
  });

export const authQueries = {
  session: authSessionQuery,
  sessionState: authSessionStateQuery,
  sessions: authSessionsQuery,
  providers: authProvidersQuery,
  slugAvailability: accountSlugAvailabilityQuery,
};
