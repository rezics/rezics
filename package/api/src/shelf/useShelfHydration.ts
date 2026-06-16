import type {
  BookDTO,
  CommentDTO,
  PostDTO,
  ShelfDTO,
  ShelfItemDTO,
  ShelfItemKind,
} from "@rezics/contract";
import { shelfItemReference } from "@rezics/contract";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { bookApi } from "../book/book.api";
import { bookKeys } from "../book/book.keys";
import { commentApi } from "../comment/comment.api";
import { commentKeys } from "../comment/comment.keys";
import { postApi } from "../post/post.api";
import { postKeys } from "../post/post.keys";
import { tagApi } from "../tag/tag.api";
import { tagKeys } from "../tag/tag.keys";
import { shelfApi } from "./shelf.api";

type HydrationBucket = "book" | "post" | "shelf" | "tag" | "comment";

const KIND_TO_BUCKET: Record<ShelfItemKind, HydrationBucket | null> = {
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
  comment: "comment",
};

// Runtime shape returned by the server's `mapTagUnitToDTO`.
// 服务端 `mapTagUnitToDTO` 返回的运行时结构。
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
      bucket: "comment";
      unitIds: string[];
      data?: CommentDTO[];
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
  /**
   * Unit ids whose underlying unit was not returned by its batch call.
   * 其底层 unit 未被对应批量调用返回的 unit id。
   */
  orphanUnitIds: string[];
  isLoading: boolean;
}

export type ShelfPrimaryDTO =
  | BookDTO
  | PostDTO
  | ShelfDTO
  | TagListEntryDTO
  | CommentDTO;

export interface EnrichedShelfItem {
  unit: ShelfItemDTO;
  /**
   * Hydrated DTO for this shelf item, if any.
   * 此书架项的已填充 DTO（若有）。
   */
  data: ShelfPrimaryDTO | undefined;
}

export interface HydratedShelfItemsResult {
  enriched: EnrichedShelfItem[];
  orphanUnitIds: string[];
  isLoading: boolean;
}

type FetchedBucketData<B extends HydrationBucket> = B extends "book"
  ? BookDTO[]
  : B extends "post"
    ? PostDTO[]
    : B extends "comment"
      ? CommentDTO[]
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
  if (bucket === "comment") {
    return Promise.all(ids.map((id) => commentApi.get(id))) as Promise<
      FetchedBucketData<B>
    >;
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
  unit: ShelfPrimaryDTO,
  setQueryData: ReturnType<typeof useQueryClient>["setQueryData"],
) {
  if (bucket === "book") setQueryData(bookKeys.detail(unit.unitId), unit);
  else if (bucket === "post") setQueryData(postKeys.detail(unit.unitId), unit);
  else if (bucket === "comment")
    setQueryData(commentKeys.detail((unit as CommentDTO).id), unit);
  else if (bucket === "tag") setQueryData(tagKeys.detail(unit.unitId), unit);
}

interface Group {
  bucket: HydrationBucket;
  unitIds: string[];
}

/**
 * Hydrate a page of shelf items: groups by kind into batched list calls,
 * seeds each package's detail cache via `queryClient.setQueryData`, and
 * reports unit ids whose underlying unit was not returned.
 * 填充一页书架项：按 kind 分组为批量 list 调用，通过
 * `queryClient.setQueryData` 预热各包的 detail 缓存，并报告其底层 unit
 * 未被返回的 unit id。
 */
export function useShelfHydration(units: ShelfItemDTO[]): ShelfHydrationResult {
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
      const bucket =
        unit.itemType === "comment" ? "comment" : KIND_TO_BUCKET[unit.kind];
      const id = shelfItemReference(unit);
      if (bucket) ensureIds(bucket).add(id);
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
        if (g.bucket === "comment") {
          return {
            bucket: "comment",
            ...base,
            data: r?.data as CommentDTO[] | undefined,
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
      if (b.bucket === "comment") {
        const found = new Set(b.data.map((u) => u.id));
        for (const id of b.unitIds) {
          if (!found.has(id)) orphans.push(id);
        }
        continue;
      }
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
 * Maps each `ShelfItem` to its hydrated DTO from the kind-grouped batch.
 * 将每个 `ShelfItem` 映射到来自按 kind 分组批量结果的已填充 DTO。
 */
export function useHydratedShelfItems(
  units: ShelfItemDTO[],
): HydratedShelfItemsResult {
  const { buckets, orphanUnitIds, isLoading } = useShelfHydration(units);

  const enriched = useMemo<EnrichedShelfItem[]>(() => {
    const bookMap = new Map<string, BookDTO>();
    const postMap = new Map<string, PostDTO>();
    const shelfMap = new Map<string, ShelfDTO>();
    const tagMap = new Map<string, TagListEntryDTO>();
    const commentMap = new Map<string, CommentDTO>();

    for (const b of buckets) {
      if (!b.data) continue;
      if (b.bucket === "book") {
        for (const dto of b.data) bookMap.set(dto.unitId, dto);
      } else if (b.bucket === "post") {
        for (const dto of b.data) postMap.set(dto.unitId, dto);
      } else if (b.bucket === "shelf") {
        for (const dto of b.data) shelfMap.set(dto.unitId, dto);
      } else if (b.bucket === "comment") {
        for (const dto of b.data) commentMap.set(dto.id, dto);
      } else {
        for (const dto of b.data) tagMap.set(dto.unitId, dto);
      }
    }

    return units.map((unit) => {
      const bucket =
        unit.itemType === "comment" ? "comment" : KIND_TO_BUCKET[unit.kind];
      const id = shelfItemReference(unit);
      let data: ShelfPrimaryDTO | undefined;
      if (bucket === "book") data = bookMap.get(id);
      else if (bucket === "post") data = postMap.get(id);
      else if (bucket === "shelf") data = shelfMap.get(id);
      else if (bucket === "tag") data = tagMap.get(id);
      else if (bucket === "comment") data = commentMap.get(id);
      return { unit, data };
    });
  }, [units, buckets]);

  return { enriched, orphanUnitIds, isLoading };
}
