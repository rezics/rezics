import type { ShelfItemDTO, ShelfItemKind } from "@rezics/contract";
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

interface BucketResult {
  bucket: HydrationBucket;
  itemRefs: string[];
  data?: Array<{ unitId: string }>;
  isLoading: boolean;
  isError: boolean;
}

export interface ShelfHydrationResult {
  /** Per-kind bucket status (useful for progressive rendering). */
  buckets: BucketResult[];
  /** itemRefs whose underlying unit was not returned by its batch call. */
  orphanItemRefs: string[];
  /** Overall loading flag — true while any bucket is still loading. */
  isLoading: boolean;
}

async function fetchBucket(
  bucket: HydrationBucket,
  ids: string[],
): Promise<Array<{ unitId: string }>> {
  if (!ids.length) return [];
  if (bucket === "book") {
    const res = await bookApi.list({ ids: ids.join(","), limit: ids.length });
    return res.books;
  }
  if (bucket === "post") {
    const res = await postApi.list({ ids: ids.join(","), limit: ids.length });
    return res.posts;
  }
  const res = await tagApi.list({ ids: ids.join(","), limit: ids.length });
  return res.tags;
}

function seedCache(
  bucket: HydrationBucket,
  item: { unitId: string },
  setQueryData: ReturnType<typeof useQueryClient>["setQueryData"],
) {
  if (bucket === "book") setQueryData(bookKeys.detail(item.unitId), item);
  else if (bucket === "post") setQueryData(postKeys.detail(item.unitId), item);
  else if (bucket === "tag") setQueryData(tagKeys.detail(item.unitId), item);
}

/**
 * Hydrate a page of shelf items: groups by kind into batched list calls,
 * seeds each package's detail cache via `queryClient.setQueryData`, and
 * reports itemRefs whose underlying unit was not returned (orphan candidates).
 */
export function useShelfHydration(items: ShelfItemDTO[]): ShelfHydrationResult {
  const queryClient = useQueryClient();

  type Group = { bucket: HydrationBucket; itemRefs: string[] };
  const grouped: Group[] = useMemo(() => {
    const map = new Map<HydrationBucket, string[]>();
    for (const item of items) {
      const bucket = KIND_TO_BUCKET[item.kind];
      if (!bucket) continue;
      const list = map.get(bucket) ?? [];
      list.push(item.itemRef);
      map.set(bucket, list);
    }
    const out: Group[] = [];
    for (const [bucket, itemRefs] of map) {
      out.push({ bucket, itemRefs });
    }
    return out;
  }, [items]);

  const results = useQueries({
    queries: grouped.map(({ bucket, itemRefs }) => ({
      queryKey: ["shelf-hydration", bucket, [...itemRefs].sort().join(",")],
      queryFn: async () => {
        const data = await fetchBucket(bucket, itemRefs);
        for (const unit of data) {
          seedCache(bucket, unit, queryClient.setQueryData.bind(queryClient));
        }
        return data;
      },
      staleTime: 1000 * 60 * 5,
      enabled: itemRefs.length > 0,
    })),
  });

  const buckets: BucketResult[] = grouped.map((g, i) => {
    const r = results[i];
    return {
      bucket: g.bucket,
      itemRefs: g.itemRefs,
      data: r?.data as Array<{ unitId: string }> | undefined,
      isLoading: r?.isLoading ?? false,
      isError: r?.isError ?? false,
    };
  });

  const orphanItemRefs = useMemo(() => {
    const orphans: string[] = [];
    for (const b of buckets) {
      if (b.isLoading || b.isError || !b.data) continue;
      const found = new Set(b.data.map((u) => u.unitId));
      for (const ref of b.itemRefs) {
        if (!found.has(ref)) orphans.push(ref);
      }
    }
    return orphans;
  }, [buckets]);

  const isLoading = buckets.some((b) => b.isLoading);

  return { buckets, orphanItemRefs, isLoading };
}
