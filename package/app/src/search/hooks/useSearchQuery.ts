import type {
  ContentSearchOptions,
  SearchQuery,
  TagRef,
} from "@rezics/contract";
import { useCallback, useMemo, useState } from "react";
import { toContentSearchOptions } from "../models/toContentSearchOptions";

export type QueryMiddleware = (
  keyword: string,
) => Partial<SearchQuery>;

export interface UseSearchQueryOptions {
  initial?: SearchQuery;
  implicitInitial?: SearchQuery;
  middleware?: QueryMiddleware;
}

type BindableField = Exclude<keyof SearchQuery, never>;

export interface UseSearchQueryReturn {
  query: SearchQuery;
  user: SearchQuery;
  implicit: SearchQuery;
  patch: (p: Partial<SearchQuery>) => void;
  set: (p: Partial<SearchQuery>) => void;
  bind: <F extends BindableField>(
    field: F,
  ) => {
    value: SearchQuery[F];
    onChange: (value: SearchQuery[F]) => void;
  };
  reset: () => void;
  toOptions: () => ContentSearchOptions;
  middleware?: QueryMiddleware;
}

function tagsEqual(a: TagRef, b: TagRef): boolean {
  if (a.unitId && b.unitId) return a.unitId === b.unitId;
  if (a.slug && b.slug) return a.slug === b.slug;
  return false;
}

function mergeTag(prev: TagRef, next: TagRef): TagRef {
  const merged: TagRef = { ...prev };
  if (!merged.unitId && next.unitId) merged.unitId = next.unitId;
  if (!merged.slug && next.slug) merged.slug = next.slug;
  if (!merged.name && next.name) merged.name = next.name;
  return merged;
}

export function unionTags(a: TagRef[], b: TagRef[]): TagRef[] {
  const out: TagRef[] = [];
  for (const tag of [...a, ...b]) {
    const existing = out.findIndex((t) => tagsEqual(t, tag));
    if (existing >= 0) {
      out[existing] = mergeTag(out[existing]!, tag);
    } else {
      out.push(tag);
    }
  }
  return out;
}

export function unionStrings(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

export function mergeAppend(
  prev: SearchQuery,
  patch: Partial<SearchQuery>,
): SearchQuery {
  const next: SearchQuery = { ...prev };

  if (patch.keyword !== undefined) next.keyword = patch.keyword;

  if (patch.tags !== undefined) {
    next.tags = unionTags(prev.tags ?? [], patch.tags);
  }

  if (patch.type !== undefined) {
    next.type = unionStrings(prev.type ?? [], patch.type);
  }

  if (patch.postKind !== undefined) {
    next.postKind = unionStrings(
      (prev.postKind ?? []) as string[],
      patch.postKind as string[],
    ) as SearchQuery["postKind"];
  }

  if (patch.languages !== undefined) {
    next.languages = unionStrings(prev.languages ?? [], patch.languages);
  }

  if (patch.nsfw !== undefined) next.nsfw = patch.nsfw;
  if (patch.isLicensed !== undefined) next.isLicensed = patch.isLicensed;
  if (patch.sort !== undefined) next.sort = patch.sort;
  if (patch.textLength !== undefined) next.textLength = patch.textLength;
  if (patch.realm !== undefined) next.realm = patch.realm;

  return next;
}

export function mergeOverwrite(
  prev: SearchQuery,
  patch: Partial<SearchQuery>,
): SearchQuery {
  return { ...prev, ...patch };
}

export function mergeEffective(
  implicit: SearchQuery,
  user: SearchQuery,
): SearchQuery {
  const out: SearchQuery = { ...implicit };

  if (user.keyword !== undefined) out.keyword = user.keyword;

  out.tags = unionTags(implicit.tags ?? [], user.tags ?? []);
  if (out.tags.length === 0) delete out.tags;

  out.type = unionStrings(implicit.type ?? [], user.type ?? []);
  if (out.type.length === 0) delete out.type;

  const postKind = unionStrings(
    (implicit.postKind ?? []) as string[],
    (user.postKind ?? []) as string[],
  );
  if (postKind.length > 0) {
    out.postKind = postKind as SearchQuery["postKind"];
  } else {
    delete out.postKind;
  }

  out.languages = unionStrings(
    implicit.languages ?? [],
    user.languages ?? [],
  );
  if (out.languages.length === 0) delete out.languages;

  if (user.nsfw !== undefined) out.nsfw = user.nsfw;
  if (user.isLicensed !== undefined) out.isLicensed = user.isLicensed;
  if (user.sort !== undefined) out.sort = user.sort;
  if (user.textLength !== undefined) out.textLength = user.textLength;
  if (user.realm !== undefined) out.realm = user.realm;

  return out;
}

export function useSearchQuery(
  options: UseSearchQueryOptions = {},
): UseSearchQueryReturn {
  const { initial, implicitInitial, middleware } = options;

  const implicit = useMemo<SearchQuery>(
    () => implicitInitial ?? {},
    [implicitInitial],
  );

  const [user, setUser] = useState<SearchQuery>(initial ?? {});

  const query = useMemo(
    () => mergeEffective(implicit, user),
    [implicit, user],
  );

  const patch = useCallback((p: Partial<SearchQuery>) => {
    setUser((prev) => mergeAppend(prev, p));
  }, []);

  const set = useCallback((p: Partial<SearchQuery>) => {
    setUser((prev) => mergeOverwrite(prev, p));
  }, []);

  const bind = useCallback(
    <F extends BindableField>(field: F) => ({
      value: query[field],
      onChange: (value: SearchQuery[F]) => {
        setUser((prev) => ({ ...prev, [field]: value }));
      },
    }),
    [query],
  );

  const reset = useCallback(() => {
    setUser(initial ?? {});
  }, [initial]);

  const toOptions = useCallback(
    () => toContentSearchOptions(query),
    [query],
  );

  return {
    query,
    user,
    implicit,
    patch,
    set,
    bind,
    reset,
    toOptions,
    middleware,
  };
}
