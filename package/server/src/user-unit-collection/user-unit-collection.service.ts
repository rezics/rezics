import type {
  CollectionSearchQuery,
  PatchUserUnitCollectionInput,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { searchClient } from "@/meili/search-client";
import {
  applyUserUnitCollectionMetadata,
  enqueueUserUnitCollectionSearchSync,
} from "@/shelf/user-unit-collection.service";
import type {
  CollectionUnitRow,
  UserUnitCollectionRow,
} from "./user-unit-collection.types";

const COLLECTION_SEARCH_HIT_LIMIT = 1000;

type CollectionSearchOptions = {
  viewerUserId?: string | null;
  publicOnly?: boolean;
};

function uniqueTrimmed(values: readonly string[] | undefined): string[] {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  );
}

function intersectIds(
  left: Set<string> | null,
  right: Set<string>,
): Set<string> {
  return left ? new Set([...left].filter((id) => right.has(id))) : right;
}

export class UserUnitCollectionService {
  async get(
    userId: string,
    unitId: string,
  ): Promise<UserUnitCollectionRow | null> {
    return prisma.userUnitCollection.findUnique({
      where: { userId_unitId: { userId, unitId } },
    });
  }

  async patch(
    userId: string,
    input: PatchUserUnitCollectionInput,
  ): Promise<UserUnitCollectionRow | null> {
    await prisma.$transaction((tx) =>
      applyUserUnitCollectionMetadata(tx, userId, input.unitId, {
        tagUnitIds: input.tagUnitIds,
        searchText: input.searchText,
      }),
    );

    if (input.searchText !== undefined) {
      await enqueueUserUnitCollectionSearchSync(userId, input.unitId);
    }

    return this.get(userId, input.unitId);
  }

  private async resolveSearchIds(
    ownerUserId: string,
    query: CollectionSearchQuery,
    options: CollectionSearchOptions,
  ): Promise<Set<string> | null> {
    const q = query.q?.trim();
    const tagUnitIds = uniqueTrimmed(query.tagUnitIds);
    if (!q && tagUnitIds.length === 0) return null;

    let allowedIds: Set<string> | null = null;

    if (q) {
      const canSearchPrivateText =
        !options.publicOnly && options.viewerUserId === ownerUserId;
      const [contentResp, collectionResp] = await Promise.all([
        searchClient.contentIndex.search(q, {
          limit: COLLECTION_SEARCH_HIT_LIMIT,
          attributesToRetrieve: ["id"],
        }),
        canSearchPrivateText
          ? searchClient.collectionIndex.search(q, {
              limit: COLLECTION_SEARCH_HIT_LIMIT,
              filter: `ownerUserId = "${ownerUserId}"`,
              attributesToRetrieve: ["unitId"],
            })
          : Promise.resolve({ hits: [] as any[] }),
      ]);
      allowedIds = new Set([
        ...(contentResp.hits as any[])
          .map((hit) => hit.id)
          .filter((id): id is string => typeof id === "string"),
        ...(collectionResp.hits as any[])
          .map((hit) => hit.unitId)
          .filter((id): id is string => typeof id === "string"),
      ]);
    }

    if (tagUnitIds.length > 0) {
      const tagRows = await prisma.userTagApplication.findMany({
        where: { userId: ownerUserId, tagUnitId: { in: tagUnitIds } },
        select: { unitId: true, tagUnitId: true },
      });
      const tagsByUnitId = new Map<string, Set<string>>();
      for (const row of tagRows) {
        const set = tagsByUnitId.get(row.unitId) ?? new Set<string>();
        set.add(row.tagUnitId);
        tagsByUnitId.set(row.unitId, set);
      }
      allowedIds = intersectIds(
        allowedIds,
        new Set(
          [...tagsByUnitId.entries()]
            .filter(([, tags]) =>
              tagUnitIds.every((tagUnitId) => tags.has(tagUnitId)),
            )
            .map(([unitId]) => unitId),
        ),
      );
    }

    return allowedIds ?? null;
  }

  async search(
    ownerUserId: string,
    query: CollectionSearchQuery = {},
    options: CollectionSearchOptions = {},
  ): Promise<{ units: CollectionUnitRow[]; hasMore: boolean }> {
    const limit = Math.max(1, Math.min(Number(query.limit ?? 100), 100));
    const searchIds = await this.resolveSearchIds(ownerUserId, query, options);

    const rows = await prisma.shelfUnit.findMany({
      where: {
        ...(searchIds ? { unitId: { in: [...searchIds] } } : {}),
        shelf: {
          unit: {
            userId: ownerUserId,
            ...(options.publicOnly
              ? { status: "PUBLISHED", visibility: "PUBLIC" }
              : {}),
          },
        },
      },
      select: { shelfId: true, unitId: true },
      orderBy: [{ unitId: "asc" }, { shelfId: "asc" }],
    });

    const shelfIdsByUnitId = new Map<string, string[]>();
    for (const row of rows) {
      const shelfIds = shelfIdsByUnitId.get(row.unitId) ?? [];
      shelfIds.push(row.shelfId);
      shelfIdsByUnitId.set(row.unitId, shelfIds);
    }

    let unitIds = [...shelfIdsByUnitId.keys()].sort();
    if (query.cursor) {
      unitIds = unitIds.filter((unitId) => unitId > query.cursor!);
    }
    const pageIds = unitIds.slice(0, limit);
    const hasMore = unitIds.length > limit;

    if (pageIds.length === 0) return { units: [], hasMore };

    const [metadataRows, tagRows] = await Promise.all([
      prisma.userUnitCollection.findMany({
        where: { userId: ownerUserId, unitId: { in: pageIds } },
      }),
      prisma.userTagApplication.findMany({
        where: { userId: ownerUserId, unitId: { in: pageIds } },
        orderBy: [{ unitId: "asc" }, { position: "asc" }],
      }),
    ]);

    const metadataByUnitId = new Map(
      metadataRows.map((row) => [row.unitId, row]),
    );
    const tagsByUnitId = new Map<string, string[]>();
    for (const row of tagRows) {
      const tagUnitIds = tagsByUnitId.get(row.unitId) ?? [];
      tagUnitIds.push(row.tagUnitId);
      tagsByUnitId.set(row.unitId, tagUnitIds);
    }

    return {
      hasMore,
      units: pageIds.map((unitId) => {
        const metadata = metadataByUnitId.get(unitId);
        return {
          userId: ownerUserId,
          unitId,
          shelfIds: shelfIdsByUnitId.get(unitId) ?? [],
          tagUnitIds: tagsByUnitId.get(unitId) ?? [],
          searchText:
            options.publicOnly || options.viewerUserId !== ownerUserId
              ? null
              : (metadata?.searchText ?? null),
          createdAt: metadata?.createdAt ?? null,
          updatedAt: metadata?.updatedAt ?? null,
        };
      }),
    };
  }
}

export const userUnitCollectionService = new UserUnitCollectionService();
