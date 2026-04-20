import type {
  BookDTO,
  PostDTO,
  ShelfItemDTO,
  ShelfItemKind,
} from "@rezics/contract";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { bookApi } from "../book/book.api";
import { bookKeys } from "../book/book.keys";
import { postApi } from "../post/post.api";
import { postKeys } from "../post/post.keys";
import { tagApi } from "../tag/tag.api";
import { tagKeys } from "../tag/tag.keys";

type HydrationBucket = "book" | "post" | "tag";

const KIND_TO_BUCKET: Record<ShelfItemKind, HydrationBucket | null> = {
  book: "book",
  review: "post",
  quote: "post",
  post: "post",
  chapter: null,
  tag: "tag",
  realm: null,
  image: null,
  video: null,
  media: null,
  game: null,
  link: null,
};

// Runtime shape returned by the server's `mapTagUnitToDTO`. The wire-typed
// `UnitTagDTO` (scored junction) does not match; aligning the contract is
// out of scope for this change.
export interface TagListEntryDTO {
  unitId: string;
  slug?: string;
  label?: string;
  translations: { language: string; title: string | null }[];
}

export type BucketResult =
  | {
      bucket: "book";
      primaryItemRefs: string[];
      ids: string[];
      data?: BookDTO[];
      isLoading: boolean;
      isError: boolean;
    }
  | {
      bucket: "post";
      primaryItemRefs: string[];
      ids: string[];
      data?: PostDTO[];
      isLoading: boolean;
      isError: boolean;
    }
  | {
      bucket: "tag";
      primaryItemRefs: string[];
      ids: string[];
      data?: TagListEntryDTO[];
      isLoading: boolean;
      isError: boolean;
    };

export interface ShelfHydrationResult {
  /** Per-kind bucket status (useful for progressive rendering). */
  buckets: BucketResult[];
  /** Primary itemRefs whose underlying unit was not returned by its batch call. */
  orphanItemRefs: string[];
  /** Overall loading flag — true while any bucket is still loading. */
  isLoading: boolean;
}

type FetchedBucketData<B extends HydrationBucket> = B extends "book"
  ? BookDTO[]
  : B extends "post"
    ? PostDTO[]
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
  const res = await tagApi.list({ ids: ids.join(","), limit: ids.length });
  return res.tags as unknown as FetchedBucketData<B>;
}

function seedCache(
  bucket: HydrationBucket,
  unit: BookDTO | PostDTO | TagListEntryDTO,
  setQueryData: ReturnType<typeof useQueryClient>["setQueryData"],
) {
  if (bucket === "book") setQueryData(bookKeys.detail(unit.unitId), unit);
  else if (bucket === "post") setQueryData(postKeys.detail(unit.unitId), unit);
  else if (bucket === "tag") setQueryData(tagKeys.detail(unit.unitId), unit);
}

interface Group {
  bucket: HydrationBucket;
  primaryItemRefs: string[];
  ids: string[];
}

/**
 * Hydrate a page of shelf items: groups by kind into batched list calls,
 * folds `reviewIds` into the post batch and `tagIds` into the tag batch,
 * seeds each package's detail cache via `queryClient.setQueryData`, and
 * reports primary itemRefs whose underlying unit was not returned.
 */
export function useShelfHydration(items: ShelfItemDTO[]): ShelfHydrationResult {
  const queryClient = useQueryClient();

  const grouped: Group[] = useMemo(() => {
    const primaryByBucket = new Map<HydrationBucket, string[]>();
    const idsByBucket = new Map<HydrationBucket, Set<string>>();

    const ensureIds = (bucket: HydrationBucket) => {
      let set = idsByBucket.get(bucket);
      if (!set) {
        set = new Set<string>();
        idsByBucket.set(bucket, set);
      }
      return set;
    };
    const ensurePrimary = (bucket: HydrationBucket) => {
      let list = primaryByBucket.get(bucket);
      if (!list) {
        list = [];
        primaryByBucket.set(bucket, list);
      }
      return list;
    };

    for (const item of items) {
      const primaryBucket = KIND_TO_BUCKET[item.kind];
      if (primaryBucket) {
        ensurePrimary(primaryBucket).push(item.itemRef);
        ensureIds(primaryBucket).add(item.itemRef);
      }
      for (const reviewId of item.reviewIds) {
        ensureIds("post").add(reviewId);
      }
      for (const tagId of item.tagIds) {
        ensureIds("tag").add(tagId);
      }
    }

    const out: Group[] = [];
    for (const [bucket, idSet] of idsByBucket) {
      out.push({
        bucket,
        primaryItemRefs: primaryByBucket.get(bucket) ?? [],
        ids: Array.from(idSet),
      });
    }
    return out;
  }, [items]);

  const results = useQueries({
    queries: grouped.map(({ bucket, ids }) => ({
      queryKey: ["shelf-hydration", bucket, [...ids].sort().join(",")],
      queryFn: async () => {
        const data = await fetchBucket(bucket, ids);
        for (const unit of data) {
          seedCache(bucket, unit, queryClient.setQueryData.bind(queryClient));
        }
        return data;
      },
      staleTime: 1000 * 60 * 5,
      enabled: ids.length > 0,
    })),
  });

  const buckets: BucketResult[] = grouped.map((g, i) => {
    const r = results[i];
    const base = {
      primaryItemRefs: g.primaryItemRefs,
      ids: g.ids,
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
    return {
      bucket: "tag",
      ...base,
      data: r?.data as TagListEntryDTO[] | undefined,
    };
  });

  const orphanItemRefs = useMemo(() => {
    const orphans: string[] = [];
    for (const b of buckets) {
      if (b.isLoading || b.isError || !b.data) continue;
      const found = new Set(b.data.map((u) => u.unitId));
      for (const ref of b.primaryItemRefs) {
        if (!found.has(ref)) orphans.push(ref);
      }
    }
    return orphans;
  }, [buckets]);

  const isLoading = buckets.some((b) => b.isLoading);

  return { buckets, orphanItemRefs, isLoading };
}
