import type { Candidate } from "./types";
import { unitParamKind } from "./unitParamKind";

export interface MatchedRoute {
  /** Route definition path string, e.g. "/book/$bookId/read/$chapterId" */
  fullPath?: string;
  path?: string;
  id?: string;
}

export interface MatchedRoutesResult {
  matchedRoutes: ReadonlyArray<MatchedRoute>;
  routeParams: Record<string, string>;
  parseError?: unknown;
}

export type GetMatchedRoutes = (pathname: string) => MatchedRoutesResult;

/**
 * Normalise a free-form URL input into a pathname.
 * Returns null if the input cannot be reduced to a path starting with `/`.
 */
function normalisePathname(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  } else {
    const queryIdx = pathname.indexOf("?");
    if (queryIdx >= 0) pathname = pathname.slice(0, queryIdx);
    const hashIdx = pathname.indexOf("#");
    if (hashIdx >= 0) pathname = pathname.slice(0, hashIdx);
  }

  if (!pathname.startsWith("/")) return null;
  return pathname;
}

const ID_PARAM_RE = /\$([A-Za-z][A-Za-z0-9]*)/g;

/**
 * Extract unit-bearing param names from a matched route's path template.
 * E.g. "/book/$bookId/read/$chapterId" → ["bookId", "chapterId"].
 */
function paramNamesFromRoute(route: MatchedRoute): string[] {
  const template = route.fullPath ?? route.path ?? route.id ?? "";
  const names: string[] = [];
  let match: RegExpExecArray | null;
  ID_PARAM_RE.lastIndex = 0;
  match = ID_PARAM_RE.exec(template);
  while (match !== null) {
    if (match[1]) names.push(match[1]);
    match = ID_PARAM_RE.exec(template);
  }
  return names;
}

/**
 * Parse a free-form URL into ordered unit candidates.
 *
 * Walks the TanStack Router match chain from outer to inner, collecting every
 * `${kind}Id` / `${kind}Slug` param. Returns the deepest (most specific) match
 * first.
 *
 * The router instance is injected as the `getMatchedRoutes` function so this
 * module stays pure and testable without React or router internals.
 */
export function parseUrlToUnitCandidates(
  getMatchedRoutes: GetMatchedRoutes,
  input: string,
): Candidate[] {
  const pathname = normalisePathname(input);
  if (!pathname) return [];

  let result: MatchedRoutesResult;
  try {
    result = getMatchedRoutes(pathname);
  } catch {
    return [];
  }

  if (result.parseError) return [];

  const ordered: Candidate[] = [];
  const seen = new Set<string>();
  for (const route of result.matchedRoutes) {
    const paramNames = paramNamesFromRoute(route);
    for (const paramName of paramNames) {
      if (seen.has(paramName)) continue;
      const identifier = result.routeParams[paramName];
      if (!identifier) continue;
      const kindInfo = unitParamKind(paramName);
      if (!kindInfo) continue;
      seen.add(paramName);
      ordered.push({
        kind: kindInfo.kind,
        identifier,
        identifierType: kindInfo.identifierType,
        paramName,
      });
    }
  }

  // Deepest-first ordering.
  return ordered.reverse();
}
