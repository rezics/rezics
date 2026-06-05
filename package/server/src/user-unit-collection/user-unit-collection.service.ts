import type {
  CollectionSearchQuery,
  PatchUserUnitCollectionInput,
} from "@rezics/contract";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  Shelf,
  ShelfUnit,
  Unit,
  UserTagApplication,
  UserUnitCollection,
} from "../db/schema";
import { searchClient } from "../meili/search-client";
import { enqueueUserUnitCollectionSearchSync } from "../shelf/user-unit-collection.service";
import type {
  CollectionUnitRow,
  UserUnitCollectionRow,
} from "./user-unit-collection.types";

const COLLECTION_SEARCH_HIT_LIMIT = 1000;

type CollectionSearchOptions = {
  viewerUserId?: string | null;
  publicOnly?: boolean;
};

type UserTagApplicationLiteRow = Pick<
  typeof UserTagApplication.$inferSelect,
  "unitId" | "tagUnitId"
>;

type ShelfUnitLiteRow = Pick<
  typeof ShelfUnit.$inferSelect,
  "shelfId" | "unitId"
>;

export interface UserUnitCollectionRepository {
  get(userId: string, unitId: string): Promise<UserUnitCollectionRow | null>;
  patchMetadata(
    userId: string,
    input: Pick<
      PatchUserUnitCollectionInput,
      "unitId" | "searchText" | "tagUnitIds"
    >,
  ): Promise<void>;
  listTagApplicationsByTags(
    userId: string,
    tagUnitIds: readonly string[],
  ): Promise<UserTagApplicationLiteRow[]>;
  listShelfUnits(input: {
    ownerUserId: string;
    unitIds?: readonly string[] | null;
    publicOnly?: boolean;
  }): Promise<ShelfUnitLiteRow[]>;
  listMetadataRows(
    userId: string,
    unitIds: readonly string[],
  ): Promise<UserUnitCollectionRow[]>;
  listTagRows(
    userId: string,
    unitIds: readonly string[],
  ): Promise<UserTagApplicationLiteRow[]>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleUserUnitCollectionRepository(): UserUnitCollectionRepository {
  return {
    async get(userId, unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select()
        .from(UserUnitCollection)
        .where(
          and(
            eq(UserUnitCollection.userId, userId),
            eq(UserUnitCollection.unitId, unitId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async patchMetadata(userId, input) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        if (input.searchText !== undefined) {
          await tx
            .insert(UserUnitCollection)
            .values({
              userId,
              unitId: input.unitId,
              searchText: input.searchText,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [UserUnitCollection.userId, UserUnitCollection.unitId],
              set: { searchText: input.searchText, updatedAt: new Date() },
            });
        }

        if (input.tagUnitIds !== undefined) {
          await tx
            .delete(UserTagApplication)
            .where(
              and(
                eq(UserTagApplication.userId, userId),
                eq(UserTagApplication.unitId, input.unitId),
              ),
            );
          const tagUnitIds = uniqueTrimmed(input.tagUnitIds);
          if (tagUnitIds.length > 0) {
            await tx
              .insert(UserTagApplication)
              .values(
                tagUnitIds.map((tagUnitId, index) => ({
                  userId,
                  unitId: input.unitId,
                  tagUnitId,
                  position: String(index).padStart(8, "0"),
                  updatedAt: new Date(),
                })),
              )
              .onConflictDoNothing();
          }
        }
      });
    },

    async listTagApplicationsByTags(userId, tagUnitIds) {
      if (tagUnitIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({
          unitId: UserTagApplication.unitId,
          tagUnitId: UserTagApplication.tagUnitId,
        })
        .from(UserTagApplication)
        .where(
          and(
            eq(UserTagApplication.userId, userId),
            inArray(UserTagApplication.tagUnitId, [...tagUnitIds]),
          ),
        );
    },

    async listShelfUnits(input) {
      const db = await getServerDb();
      const conditions = [
        eq(Unit.userId, input.ownerUserId),
        input.unitIds?.length
          ? inArray(ShelfUnit.unitId, [...input.unitIds])
          : undefined,
        input.publicOnly ? eq(Unit.status, "PUBLISHED") : undefined,
        input.publicOnly ? eq(Unit.visibility, "PUBLIC") : undefined,
      ].filter(Boolean);
      return db
        .select({ shelfId: ShelfUnit.shelfId, unitId: ShelfUnit.unitId })
        .from(ShelfUnit)
        .innerJoin(Shelf, eq(Shelf.unitId, ShelfUnit.shelfId))
        .innerJoin(Unit, eq(Unit.id, Shelf.unitId))
        .where(and(...conditions))
        .orderBy(asc(ShelfUnit.unitId), asc(ShelfUnit.shelfId));
    },

    async listMetadataRows(userId, unitIds) {
      if (unitIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select()
        .from(UserUnitCollection)
        .where(
          and(
            eq(UserUnitCollection.userId, userId),
            inArray(UserUnitCollection.unitId, [...unitIds]),
          ),
        );
    },

    async listTagRows(userId, unitIds) {
      if (unitIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({
          unitId: UserTagApplication.unitId,
          tagUnitId: UserTagApplication.tagUnitId,
        })
        .from(UserTagApplication)
        .where(
          and(
            eq(UserTagApplication.userId, userId),
            inArray(UserTagApplication.unitId, [...unitIds]),
          ),
        )
        .orderBy(
          asc(UserTagApplication.unitId),
          asc(UserTagApplication.position),
        );
    },
  };
}

const defaultRepository = createDrizzleUserUnitCollectionRepository();

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
  constructor(
    private readonly repository: UserUnitCollectionRepository = defaultRepository,
  ) {}

  async get(
    userId: string,
    unitId: string,
  ): Promise<UserUnitCollectionRow | null> {
    return this.repository.get(userId, unitId);
  }

  async patch(
    userId: string,
    input: PatchUserUnitCollectionInput,
  ): Promise<UserUnitCollectionRow | null> {
    await this.repository.patchMetadata(userId, {
      unitId: input.unitId,
      tagUnitIds: input.tagUnitIds,
      searchText: input.searchText,
    });

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
      const tagRows = await this.repository.listTagApplicationsByTags(
        ownerUserId,
        tagUnitIds,
      );
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

    const rows = await this.repository.listShelfUnits({
      ownerUserId,
      unitIds: searchIds ? [...searchIds] : null,
      publicOnly: options.publicOnly,
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
      this.repository.listMetadataRows(ownerUserId, pageIds),
      this.repository.listTagRows(ownerUserId, pageIds),
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
