import type {
  BookDTO,
  PostDTO,
  ShelfDTO,
  ShelfUnitDTO,
  ShelfUnitKind,
} from "@rezics/contract";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { bookApi } from "../book/book.api";
import { bookKeys } from "../book/book.keys";
import { postApi } from "../post/post.api";
import { postKeys } from "../post/post.keys";
import { tagApi } from "../tag/tag.api";
import { tagKeys } from "../tag/tag.keys";
import { shelfApi } from "./shelf.api";

type HydrationBucket = "book" | "post" | "shelf" | "tag";

const KIND_TO_BUCKET: Record<ShelfUnitKind, HydrationBucket | null> = {
  book: "book",
  review: "post",
  quote: "post",
  post: "post",
  chapter: null,
  shelf: "shelf",
  tag: "tag",
  realm: null,
  image: null,
  video: null,
  media: null,
  game: null,
  link: null,
};

// Runtime shape returned by the server's `mapTagUnitToDTO`.
export interface TagListEntryDTO {
  unitId: string;
  slug?: string;
  label?: string;
  translations: { language: string; title: string | null }[];
}

export type BucketResult =
  | {
      bucket: "book";
      unitIds: string[];
      data?: BookDTO[];
      isLoading: boolean;
      isError: boolean;
    }
  | {
      bucket: "post";
      unitIds: string[];
      data?: PostDTO[];
      isLoading: boolean;
      isError: boolean;
    }
  | {
      bucket: "tag";
      unitIds: string[];
      data?: TagListEntryDTO[];
      isLoading: boolean;
      isError: boolean;
    }
  | {
      bucket: "shelf";
      unitIds: string[];
      data?: ShelfDTO[];
      isLoading: boolean;
      isError: boolean;
    };

export interface ShelfHydrationResult {
  buckets: BucketResult[];
  /** Unit ids whose underlying unit was not returned by its batch call. */
  orphanUnitIds: string[];
  isLoading: boolean;
}

export type ShelfPrimaryDTO = BookDTO | PostDTO | ShelfDTO | TagListEntryDTO;

export interface EnrichedShelfUnit {
  unit: ShelfUnitDTO;
  /** Hydrated DTO for this shelf unit, if any. */
  data: ShelfPrimaryDTO | undefined;
}

export interface HydratedShelfUnitsResult {
  enriched: EnrichedShelfUnit[];
  orphanUnitIds: string[];
  isLoading: boolean;
}

type FetchedBucketData<B extends HydrationBucket> = B extends "book"
  ? BookDTO[]
  : B extends "post"
    ? PostDTO[]
    : B extends "shelf"
      ? ShelfDTO[]
      : TagListEntryDTO[];

async function fetchBucket<B extends HydrationBucket>(
  bucket: B,
  ids: string[],
): Promise<FetchedBucketData<B>> {
  if (!ids.length) return [] as unknown as FetchedBucketData<B>;
  if (bucket === "book") {
    const res = await bookApi.list({ ids: ids.join(","), limit: ids.length });
    return res.books as FetchedBucketData<B>;
  }
  if (bucket === "post") {
    const res = await postApi.list({ ids: ids.join(","), limit: ids.length });
    return res.posts as FetchedBucketData<B>;
  }
  if (bucket === "shelf") {
    const res = await shelfApi.list({ ids: ids.join(","), limit: ids.length });
    return res.shelves as FetchedBucketData<B>;
  }
  const res = await tagApi.list({ ids: ids.join(","), limit: ids.length });
  return res.tags as unknown as FetchedBucketData<B>;
}

function seedCache(
  bucket: HydrationBucket,
  unit: BookDTO | PostDTO | ShelfDTO | TagListEntryDTO,
  setQueryData: ReturnType<typeof useQueryClient>["setQueryData"],
) {
  if (bucket === "book") setQueryData(bookKeys.detail(unit.unitId), unit);
  else if (bucket === "post") setQueryData(postKeys.detail(unit.unitId), unit);
  else if (bucket === "tag") setQueryData(tagKeys.detail(unit.unitId), unit);
}

interface Group {
  bucket: HydrationBucket;
  unitIds: string[];
}

/**
 * Hydrate a page of shelf units: groups by kind into batched list calls,
 * seeds each package's detail cache via `queryClient.setQueryData`, and
 * reports unit ids whose underlying unit was not returned.
 */
export function useShelfHydration(units: ShelfUnitDTO[]): ShelfHydrationResult {
  const queryClient = useQueryClient();

  const grouped: Group[] = useMemo(() => {
    const idsByBucket = new Map<HydrationBucket, Set<string>>();

    const ensureIds = (bucket: HydrationBucket) => {
      let set = idsByBucket.get(bucket);
      if (!set) {
        set = new Set<string>();
        idsByBucket.set(bucket, set);
      }
      return set;
    };

    for (const unit of units) {
      const bucket = KIND_TO_BUCKET[unit.kind];
      if (bucket) ensureIds(bucket).add(unit.unitId);
    }

    const out: Group[] = [];
    for (const [bucket, idSet] of idsByBucket) {
      out.push({ bucket, unitIds: Array.from(idSet) });
    }
    return out;
  }, [units]);

  const results = useQueries({
    queries: grouped.map(({ bucket, unitIds }) => ({
      queryKey: ["shelf-hydration", bucket, [...unitIds].sort().join(",")],
      queryFn: async () => {
        const data = await fetchBucket(bucket, unitIds);
        for (const unit of data) {
          seedCache(bucket, unit, queryClient.setQueryData.bind(queryClient));
        }
        return data;
      },
      staleTime: 1000 * 60 * 5,
      enabled: unitIds.length > 0,
    })),
  });

  const buckets: BucketResult[] = useMemo(
    () =>
      grouped.map((g, i) => {
        const r = results[i];
        const base = {
          unitIds: g.unitIds,
          isLoading: r?.isLoading ?? false,
          isError: r?.isError ?? false,
        };
        if (g.bucket === "book") {
          return {
            bucket: "book",
            ...base,
            data: r?.data as BookDTO[] | undefined,
          };
        }
        if (g.bucket === "post") {
          return {
            bucket: "post",
            ...base,
            data: r?.data as PostDTO[] | undefined,
          };
        }
        if (g.bucket === "shelf") {
          return {
            bucket: "shelf",
            ...base,
            data: r?.data as ShelfDTO[] | undefined,
          };
        }
        return {
          bucket: "tag",
          ...base,
          data: r?.data as TagListEntryDTO[] | undefined,
        };
      }),
    [grouped, results],
  );

  const orphanUnitIds = useMemo(() => {
    const orphans: string[] = [];
    for (const b of buckets) {
      if (b.isLoading || b.isError || !b.data) continue;
      const found = new Set(b.data.map((u) => u.unitId));
      for (const id of b.unitIds) {
        if (!found.has(id)) orphans.push(id);
      }
    }
    return orphans;
  }, [buckets]);

  const isLoading = useMemo(() => buckets.some((b) => b.isLoading), [buckets]);

  return { buckets, orphanUnitIds, isLoading };
}

/**
 * Maps each `ShelfUnit` to its hydrated DTO from the kind-grouped batch.
 */
export function useHydratedShelfUnits(
  units: ShelfUnitDTO[],
): HydratedShelfUnitsResult {
  const { buckets, orphanUnitIds, isLoading } = useShelfHydration(units);

  const enriched = useMemo<EnrichedShelfUnit[]>(() => {
    const bookMap = new Map<string, BookDTO>();
    const postMap = new Map<string, PostDTO>();
    const shelfMap = new Map<string, ShelfDTO>();
    const tagMap = new Map<string, TagListEntryDTO>();

    for (const b of buckets) {
      if (!b.data) continue;
      if (b.bucket === "book") {
        for (const dto of b.data) bookMap.set(dto.unitId, dto);
      } else if (b.bucket === "post") {
        for (const dto of b.data) postMap.set(dto.unitId, dto);
      } else if (b.bucket === "shelf") {
        for (const dto of b.data) shelfMap.set(dto.unitId, dto);
      } else {
        for (const dto of b.data) tagMap.set(dto.unitId, dto);
      }
    }

    return units.map((unit) => {
      const bucket = KIND_TO_BUCKET[unit.kind];
      let data: ShelfPrimaryDTO | undefined;
      if (bucket === "book") data = bookMap.get(unit.unitId);
      else if (bucket === "post") data = postMap.get(unit.unitId);
      else if (bucket === "shelf") data = shelfMap.get(unit.unitId);
      else if (bucket === "tag") data = tagMap.get(unit.unitId);
      return { unit, data };
    });
  }, [units, buckets]);

  return { enriched, orphanUnitIds, isLoading };
}
