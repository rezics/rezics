import { ApiError } from "@rezics/api";
import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

/**
 * Backend 404 is the only client-side signal that a queried resource is absent.
 * Route loaders promote it to router 404; component-local queries render it in
 * place so one missing widget dependency cannot take down the whole page.
 */
export function isApiNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

type EnsureQueryDataOptions = Parameters<QueryClient["ensureQueryData"]>[0];

/**
 * Load a route's primary resource or hand control to the router not-found
 * boundary. Use this only in route loaders; component-local queries should stay
 * contained with ResourceNotFoundState.
 */
export async function routeQueryOrNotFound<T>(
  queryClient: QueryClient,
  options: EnsureQueryDataOptions,
): Promise<T> {
  try {
    return (await queryClient.ensureQueryData(options)) as T;
  } catch {
    throw notFound();
  }
}
