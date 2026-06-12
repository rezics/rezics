import type {
  CreateGameSystemRequirementInput,
  GameSystemRequirementListFilters,
  UpdateGameSystemRequirementInput,
} from "@rezics/contract";
import { and, asc, eq, isNull, type SQL } from "drizzle-orm";
import {
  Entity,
  Game,
  GameSystemRequirement,
  UnitExternalLink,
} from "../db/schema";
import { AppError } from "../utils/errors";
import type { GameSystemRequirementRow } from "./types";

type PlatformEntityRow = Pick<
  typeof Entity.$inferSelect,
  "kind" | "eligibleSubjectRoles"
>;
type SourceExternalLinkRow = Pick<
  typeof UnitExternalLink.$inferSelect,
  "id" | "unitId"
>;

type GameSystemRequirementRepository = {
  findGame(gameUnitId: string): Promise<{ unitId: string } | undefined>;
  findPlatformEntity(
    platformEntityId: string,
  ): Promise<PlatformEntityRow | undefined>;
  findSourceExternalLink(
    sourceExternalLinkId: string,
  ): Promise<SourceExternalLinkRow | undefined>;
  list(
    filters?: GameSystemRequirementListFilters,
  ): Promise<GameSystemRequirementRow[]>;
  getById(id: string): Promise<GameSystemRequirementRow | undefined>;
  create(
    input: CreateGameSystemRequirementInput,
  ): Promise<GameSystemRequirementRow>;
  findRequirementGameUnitId(id: string): Promise<string | undefined>;
  update(
    id: string,
    input: UpdateGameSystemRequirementInput,
  ): Promise<GameSystemRequirementRow>;
  delete(id: string): Promise<void>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function buildListConditions(
  filters: GameSystemRequirementListFilters = {},
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.gameUnitId) {
    conditions.push(eq(GameSystemRequirement.gameUnitId, filters.gameUnitId));
  }
  if (filters.platformEntityId !== undefined) {
    conditions.push(
      filters.platformEntityId === null
        ? isNull(GameSystemRequirement.platformEntityId)
        : eq(GameSystemRequirement.platformEntityId, filters.platformEntityId),
    );
  }
  if (filters.tier) {
    conditions.push(eq(GameSystemRequirement.tier, filters.tier));
  }
  if (filters.language) {
    conditions.push(eq(GameSystemRequirement.language, filters.language));
  }
  if (filters.sourceExternalLinkId) {
    conditions.push(
      eq(
        GameSystemRequirement.sourceExternalLinkId,
        filters.sourceExternalLinkId,
      ),
    );
  }
  return conditions;
}

function createDrizzleGameSystemRequirementRepository(): GameSystemRequirementRepository {
  return {
    async findGame(gameUnitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ unitId: Game.unitId })
        .from(Game)
        .where(eq(Game.unitId, gameUnitId))
        .limit(1);
      return row;
    },

    async findPlatformEntity(platformEntityId) {
      const db = await getServerDb();
      const [row] = await db
        .select({
          kind: Entity.kind,
          eligibleSubjectRoles: Entity.eligibleSubjectRoles,
        })
        .from(Entity)
        .where(eq(Entity.unitId, platformEntityId))
        .limit(1);
      return row;
    },

    async findSourceExternalLink(sourceExternalLinkId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ id: UnitExternalLink.id, unitId: UnitExternalLink.unitId })
        .from(UnitExternalLink)
        .where(eq(UnitExternalLink.id, sourceExternalLinkId))
        .limit(1);
      return row;
    },

    async list(filters) {
      const db = await getServerDb();
      const conditions = buildListConditions(filters);
      return db
        .select()
        .from(GameSystemRequirement)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(
          asc(GameSystemRequirement.platformEntityId),
          asc(GameSystemRequirement.tier),
          asc(GameSystemRequirement.language),
          asc(GameSystemRequirement.createdAt),
        );
    },

    async getById(id) {
      const db = await getServerDb();
      const [row] = await db
        .select()
        .from(GameSystemRequirement)
        .where(eq(GameSystemRequirement.id, id))
        .limit(1);
      return row;
    },

    async create(input) {
      const db = await getServerDb();
      const now = new Date();
      const [row] = await db
        .insert(GameSystemRequirement)
        .values({
          gameUnitId: input.gameUnitId,
          platformEntityId: input.platformEntityId ?? null,
          tier: input.tier,
          language: input.language ?? null,
          sourceExternalLinkId: input.sourceExternalLinkId ?? null,
          hardware: input.hardware,
          rawText: input.rawText ?? null,
          updatedAt: now,
        })
        .returning();
      if (!row) {
        throw new AppError(500, "Game system requirement was not created", {
          code: "game_requirement_create_failed",
        });
      }
      return row;
    },

    async findRequirementGameUnitId(id) {
      const db = await getServerDb();
      const [row] = await db
        .select({ gameUnitId: GameSystemRequirement.gameUnitId })
        .from(GameSystemRequirement)
        .where(eq(GameSystemRequirement.id, id))
        .limit(1);
      return row?.gameUnitId;
    },

    async update(id, input) {
      const db = await getServerDb();
      const [row] = await db
        .update(GameSystemRequirement)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(GameSystemRequirement.id, id))
        .returning();
      if (!row) {
        throw new AppError(404, "Game system requirement not found", {
          code: "game_requirement_not_found",
          details: { id },
        });
      }
      return row;
    },

    async delete(id) {
      const db = await getServerDb();
      await db
        .delete(GameSystemRequirement)
        .where(eq(GameSystemRequirement.id, id));
    },
  };
}

async function assertGameExists(
  repository: GameSystemRequirementRepository,
  gameUnitId: string,
) {
  const game = await repository.findGame(gameUnitId);
  if (!game) {
    throw new AppError(404, "Game not found", {
      code: "game_not_found",
      details: { gameUnitId },
    });
  }
}

async function assertPlatformEntity(
  repository: GameSystemRequirementRepository,
  platformEntityId: string | null | undefined,
) {
  if (!platformEntityId) {
    return;
  }

  const platform = await repository.findPlatformEntity(platformEntityId);
  if (
    !platform ||
    platform.kind !== "game_platform" ||
    !platform.eligibleSubjectRoles.includes("available_on")
  ) {
    throw new AppError(400, "Platform must be a game_platform Entity", {
      code: "game_requirement_platform_invalid",
      details: { platformEntityId },
    });
  }
}

async function assertSourceExternalLink(
  repository: GameSystemRequirementRepository,
  gameUnitId: string,
  sourceExternalLinkId: string | null | undefined,
) {
  if (!sourceExternalLinkId) {
    return;
  }

  const sourceExternalLink =
    await repository.findSourceExternalLink(sourceExternalLinkId);
  if (!sourceExternalLink) {
    throw new AppError(404, "Game system requirement source link not found", {
      code: "game_requirement_source_link_not_found",
      details: { sourceExternalLinkId },
    });
  }
  if (sourceExternalLink.unitId !== gameUnitId) {
    throw new AppError(
      400,
      "Game system requirement sourceExternalLinkId must reference the same game Unit",
      {
        code: "game_requirement_source_link_unit_mismatch",
        details: {
          gameUnitId,
          sourceExternalLinkId,
          sourceExternalLinkUnitId: sourceExternalLink.unitId,
        },
      },
    );
  }
}

export class GameSystemRequirementService {
  constructor(
    private readonly repository = createDrizzleGameSystemRequirementRepository(),
  ) {}

  async list(filters: GameSystemRequirementListFilters = {}) {
    return this.repository.list(filters);
  }

  async getById(id: string) {
    return this.repository.getById(id);
  }

  async create(input: CreateGameSystemRequirementInput) {
    await assertGameExists(this.repository, input.gameUnitId);
    await assertPlatformEntity(this.repository, input.platformEntityId);
    await assertSourceExternalLink(
      this.repository,
      input.gameUnitId,
      input.sourceExternalLinkId,
    );

    return this.repository.create(input);
  }

  async update(id: string, input: UpdateGameSystemRequirementInput) {
    if (input.platformEntityId !== undefined) {
      await assertPlatformEntity(this.repository, input.platformEntityId);
    }
    if (input.sourceExternalLinkId !== undefined) {
      const gameUnitId = await this.repository.findRequirementGameUnitId(id);
      if (!gameUnitId) {
        throw new AppError(404, "Game system requirement not found", {
          code: "game_requirement_not_found",
          details: { id },
        });
      }
      await assertSourceExternalLink(
        this.repository,
        gameUnitId,
        input.sourceExternalLinkId,
      );
    }

    return this.repository.update(id, input);
  }

  async delete(id: string) {
    await this.repository.delete(id);
  }
}

export const gameSystemRequirementService = new GameSystemRequirementService();
