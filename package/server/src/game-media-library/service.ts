import type {
  GameLibraryContentDTO,
  MediaLibraryContentDTO,
} from "@rezics/contract";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  ContentStructure,
  ContentStructureNode,
  Entity,
  Game,
  GameSystemRequirement,
  Media,
  SubjectAttribution,
  Unit,
  UnitTag,
  UnitTranslation,
} from "../db/schema";
import {
  mapGameLibraryContentToDTO,
  mapMediaLibraryContentToDTO,
} from "./mapper";
import { rebalance } from "../shelf/fractional-index";
import type { GameLibraryRow, MediaLibraryRow } from "./types";

export interface GameMetadataRelationInput {
  platformEntityIds?: readonly string[];
  ageRatingTagUnitIds?: readonly string[];
}

export interface GameMediaLibraryRepository {
  getGame(unitId: string): Promise<GameLibraryRow | null>;
  getMedia(unitId: string): Promise<MediaLibraryRow | null>;
  listValidGamePlatformIds(entityIds: readonly string[]): Promise<string[]>;
  appendAvailableOnRelations(
    gameUnitId: string,
    platformEntityIds: readonly string[],
  ): Promise<void>;
  appendAgeRatingTags(
    unitId: string,
    tagUnitIds: readonly string[],
  ): Promise<void>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function loadOwnedContentStructure(unitId: string) {
  const db = await getServerDb();
  const [contentStructure] = await db
    .select()
    .from(ContentStructure)
    .where(eq(ContentStructure.ownerUnitId, unitId))
    .limit(1);
  if (!contentStructure) return null;

  const contentNodes = await db
    .select()
    .from(ContentStructureNode)
    .where(eq(ContentStructureNode.ownerUnitId, unitId))
    .orderBy(
      asc(ContentStructureNode.position),
      asc(ContentStructureNode.createdAt),
      asc(ContentStructureNode.id),
    );
  return { ...contentStructure, contentNodes };
}

async function loadUnitTranslations(unitId: string) {
  const db = await getServerDb();
  return db
    .select()
    .from(UnitTranslation)
    .where(eq(UnitTranslation.unitId, unitId));
}

async function loadUnitTagsWithSlug(unitId: string) {
  const db = await getServerDb();
  const rows = await db
    .select()
    .from(UnitTag)
    .where(eq(UnitTag.unitId, unitId));
  const tagIds = rows.map((row) => row.tagUnitId);
  if (tagIds.length === 0) return rows.map((row) => ({ ...row }));

  const tags = await db
    .select({ id: Unit.id, slug: Unit.slug })
    .from(Unit)
    .where(inArray(Unit.id, tagIds));
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  return rows.map((row) => ({
    ...row,
    tag: tagById.get(row.tagUnitId),
  }));
}

function createDrizzleGameMediaLibraryRepository(): GameMediaLibraryRepository {
  return {
    async getGame(unitId) {
      const db = await getServerDb();
      const [game] = await db
        .select()
        .from(Game)
        .where(eq(Game.unitId, unitId))
        .limit(1);
      if (!game) return null;

      const [unit] = await db
        .select()
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      if (!unit) return null;

      const [
        translations,
        subjectAttributions,
        unitTags,
        ownedContentStructure,
        systemRequirements,
      ] = await Promise.all([
        loadUnitTranslations(unitId),
        db
          .select()
          .from(SubjectAttribution)
          .where(
            and(
              eq(SubjectAttribution.unitId, unitId),
              eq(SubjectAttribution.role, "available_on"),
            ),
          )
          .orderBy(
            asc(SubjectAttribution.position),
            asc(SubjectAttribution.entityId),
          ),
        loadUnitTagsWithSlug(unitId),
        loadOwnedContentStructure(unitId),
        db
          .select()
          .from(GameSystemRequirement)
          .where(eq(GameSystemRequirement.gameUnitId, unitId))
          .orderBy(
            asc(GameSystemRequirement.platformEntityId),
            asc(GameSystemRequirement.tier),
          ),
      ]);

      return {
        ...game,
        unit: {
          ...unit,
          translations,
          subjectAttributions,
          unitTags,
          ownedContentStructure,
        },
        systemRequirements,
      };
    },

    async getMedia(unitId) {
      const db = await getServerDb();
      const [media] = await db
        .select()
        .from(Media)
        .where(eq(Media.unitId, unitId))
        .limit(1);
      if (!media) return null;

      const [unit] = await db
        .select()
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      if (!unit) return null;

      const [translations, unitTags, ownedContentStructure] = await Promise.all(
        [
          loadUnitTranslations(unitId),
          loadUnitTagsWithSlug(unitId),
          loadOwnedContentStructure(unitId),
        ],
      );

      return {
        ...media,
        unit: {
          ...unit,
          translations,
          unitTags,
          ownedContentStructure,
        },
      };
    },

    async listValidGamePlatformIds(entityIds) {
      if (entityIds.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({ unitId: Entity.unitId })
        .from(Entity)
        .where(
          and(
            inArray(Entity.unitId, [...entityIds]),
            eq(Entity.kind, "game_platform"),
            sql`${Entity.eligibleSubjectRoles} @> ARRAY['available_on']::text[]`,
          ),
        );
      return rows.map((row) => row.unitId);
    },

    async appendAvailableOnRelations(gameUnitId, platformEntityIds) {
      if (platformEntityIds.length === 0) return;
      const db = await getServerDb();
      const positions = rebalance(platformEntityIds.length);
      await db
        .insert(SubjectAttribution)
        .values(
          platformEntityIds.map((entityId, index) => ({
            unitId: gameUnitId,
            entityId,
            role: "available_on",
            position: positions[index]!,
          })),
        )
        .onConflictDoNothing();
    },

    async appendAgeRatingTags(unitId, tagUnitIds) {
      if (tagUnitIds.length === 0) return;
      const db = await getServerDb();
      const now = new Date();
      await db
        .insert(UnitTag)
        .values(
          tagUnitIds.map((tagUnitId) => ({
            unitId,
            tagUnitId,
            score: 0,
            voteCount: 0,
            pinned: true,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing();
    },
  };
}

const defaultRepository = createDrizzleGameMediaLibraryRepository();

export class GameMediaLibraryService {
  constructor(
    private readonly repository: GameMediaLibraryRepository = defaultRepository,
  ) {}

  async getGame(unitId: string): Promise<GameLibraryContentDTO | null> {
    const row = await this.repository.getGame(unitId);
    return row ? mapGameLibraryContentToDTO(row) : null;
  }

  async getMedia(unitId: string): Promise<MediaLibraryContentDTO | null> {
    const row = await this.repository.getMedia(unitId);
    return row ? mapMediaLibraryContentToDTO(row) : null;
  }

  async appendGameMetadataRelations(
    gameUnitId: string,
    input: GameMetadataRelationInput,
  ): Promise<void> {
    if (input.platformEntityIds?.length) {
      const platformEntityIds = [...input.platformEntityIds];
      const found = new Set(
        await this.repository.listValidGamePlatformIds(platformEntityIds),
      );
      const missing = input.platformEntityIds.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new Error(
          `Invalid game platform Entity id(s): ${missing.join(", ")}`,
        );
      }

      await this.repository.appendAvailableOnRelations(
        gameUnitId,
        platformEntityIds,
      );
    }

    if (input.ageRatingTagUnitIds?.length) {
      await this.repository.appendAgeRatingTags(
        gameUnitId,
        input.ageRatingTagUnitIds,
      );
    }
  }
}

export const gameMediaLibraryService = new GameMediaLibraryService();
