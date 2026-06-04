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
  UnitExternalRef,
} from "../db/schema";
import { AppError } from "../utils/errors";
import type { GameSystemRequirementRow } from "./types";

type PlatformEntityRow = Pick<
  typeof Entity.$inferSelect,
  "kind" | "eligibleSubjectRoles"
>;
type SourceRefRow = Pick<typeof UnitExternalRef.$inferSelect, "id" | "unitId">;

type GameSystemRequirementRepository = {
  findGame(gameUnitId: string): Promise<{ unitId: string } | undefined>;
  findPlatformEntity(
    platformEntityId: string,
  ): Promise<PlatformEntityRow | undefined>;
  findSourceRef(sourceRefId: string): Promise<SourceRefRow | undefined>;
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
  if (filters.sourceRefId) {
    conditions.push(eq(GameSystemRequirement.sourceRefId, filters.sourceRefId));
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

    async findSourceRef(sourceRefId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ id: UnitExternalRef.id, unitId: UnitExternalRef.unitId })
        .from(UnitExternalRef)
        .where(eq(UnitExternalRef.id, sourceRefId))
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
          sourceRefId: input.sourceRefId ?? null,
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

async function assertSourceRef(
  repository: GameSystemRequirementRepository,
  gameUnitId: string,
  sourceRefId: string | null | undefined,
) {
  if (!sourceRefId) {
    return;
  }

  const sourceRef = await repository.findSourceRef(sourceRefId);
  if (!sourceRef) {
    throw new AppError(404, "Game system requirement source ref not found", {
      code: "game_requirement_source_ref_not_found",
      details: { sourceRefId },
    });
  }
  if (sourceRef.unitId !== gameUnitId) {
    throw new AppError(
      400,
      "Game system requirement sourceRefId must reference the same game Unit",
      {
        code: "game_requirement_source_ref_unit_mismatch",
        details: { gameUnitId, sourceRefId, sourceRefUnitId: sourceRef.unitId },
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
    await assertSourceRef(this.repository, input.gameUnitId, input.sourceRefId);

    return this.repository.create(input);
  }

  async update(id: string, input: UpdateGameSystemRequirementInput) {
    if (input.platformEntityId !== undefined) {
      await assertPlatformEntity(this.repository, input.platformEntityId);
    }
    if (input.sourceRefId !== undefined) {
      const gameUnitId = await this.repository.findRequirementGameUnitId(id);
      if (!gameUnitId) {
        throw new AppError(404, "Game system requirement not found", {
          code: "game_requirement_not_found",
          details: { id },
        });
      }
      await assertSourceRef(this.repository, gameUnitId, input.sourceRefId);
    }

    return this.repository.update(id, input);
  }

  async delete(id: string) {
    await this.repository.delete(id);
  }
}

export const gameSystemRequirementService = new GameSystemRequirementService();
