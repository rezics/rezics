import { unitQueries } from "@rezics/api/unit/unit.queries";
import type { UnitResponse } from "@rezics/contract";
import { useQueries } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import type {
  GetMatchedRoutes,
  MatchedRoutesResult,
} from "../models/parseUrlToUnitCandidates";
import { parseUrlToUnitCandidates } from "../models/parseUrlToUnitCandidates";
import type { Candidate } from "../models/types";

export interface ResolvedCandidate {
  candidate: Candidate;
  unit?: UnitResponse;
  isLoading: boolean;
  error?: unknown;
}

export interface UseUnitCandidatesResult {
  candidates: Candidate[];
  resolved: ResolvedCandidate[];
  parseError: boolean;
}

const DEBOUNCE_MS = 150;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Resolve a free-form URL input into URL-derived unit candidates and fetch
 * each candidate's metadata. Pure parsing logic lives in
 * `models/parseUrlToUnitCandidates`; this hook only wires the router and
 * React Query.
 */
export function useUnitCandidates(input: string): UseUnitCandidatesResult {
  const router = useRouter();
  const readContext = useReadLanguageContext();
  const debounced = useDebouncedValue(input, DEBOUNCE_MS);

  const getMatchedRoutes = useMemo<GetMatchedRoutes>(
    () => (pathname: string) =>
      router.getMatchedRoutes(pathname) as MatchedRoutesResult,
    [router],
  );

  const candidates = useMemo(() => {
    if (!debounced.trim()) return [];
    return parseUrlToUnitCandidates(getMatchedRoutes, debounced);
  }, [debounced, getMatchedRoutes]);

  const parseError = useMemo(() => {
    if (!debounced.trim()) return false;
    return candidates.length === 0;
  }, [candidates, debounced]);

  const queries = useQueries({
    queries: candidates.map((c) => {
      const opts =
        c.identifierType === "slug"
          ? unitQueries.bySlug(c.identifier)
          : unitQueries.detail(c.identifier, {
              languages: readContext.languages,
              appLocale: readContext.appLocale,
            });
      return {
        ...opts,
        enabled: readContext.ready && Boolean(c.identifier),
      };
    }),
  });

  const resolved = useMemo<ResolvedCandidate[]>(
    () =>
      candidates.map((candidate, idx) => {
        const q = queries[idx];
        return {
          candidate,
          unit: q?.data,
          isLoading: q?.isLoading ?? false,
          error: q?.error,
        };
      }),
    [candidates, queries],
  );

  return { candidates, resolved, parseError };
}
