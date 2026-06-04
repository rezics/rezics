import { describe, expect, test } from "bun:test";
import { mapGameSystemRequirementToDTO } from "./mapper";
import { GameSystemRequirementService } from "./service";

const now = new Date("2026-05-28T00:00:00.000Z");

function requirementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    gameUnitId: "game-1",
    platformEntityId: "platform-windows",
    tier: "minimum",
    language: "en",
    sourceRefId: "source-ref-1",
    hardware: { memory: "8 GB" },
    rawText: "Requires a 64-bit processor and operating system.",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function freshRepository() {
  const row = requirementRow();
  const calls: Array<{ method: string; input: unknown }> = [];
  return {
    calls,
    repository: {
      async findGame(gameUnitId: string) {
        calls.push({ method: "findGame", input: gameUnitId });
        return { unitId: "game-1" };
      },
      async findPlatformEntity(platformEntityId: string) {
        calls.push({ method: "findPlatformEntity", input: platformEntityId });
        return {
          kind: "game_platform",
          eligibleSubjectRoles: ["available_on"],
        };
      },
      async findSourceRef(sourceRefId: string) {
        calls.push({ method: "findSourceRef", input: sourceRefId });
        return { id: sourceRefId, unitId: "game-1" };
      },
      async list(filters: unknown) {
        calls.push({ method: "list", input: filters });
        return [row];
      },
      async getById(id: string) {
        calls.push({ method: "getById", input: id });
        return row;
      },
      async create(input: unknown) {
        calls.push({ method: "create", input });
        return { ...row, ...(input as Record<string, unknown>) };
      },
      async findRequirementGameUnitId(id: string) {
        calls.push({ method: "findRequirementGameUnitId", input: id });
        return row.gameUnitId;
      },
      async update(id: string, input: unknown) {
        calls.push({ method: "update", input: { id, input } });
        return { ...row, ...(input as Record<string, unknown>) };
      },
      async delete(id: string) {
        calls.push({ method: "delete", input: id });
      },
    },
  };
}

describe("GameSystemRequirementService", () => {
  test("lists requirements with contract filters", async () => {
    const { repository, calls } = freshRepository();
    const service = new GameSystemRequirementService(repository);

    const filters = {
      gameUnitId: "game-1",
      platformEntityId: "platform-windows",
      tier: "minimum",
      language: "en",
      sourceRefId: "source-ref-1",
    } as const;
    const rows = await service.list(filters);

    expect(rows).toHaveLength(1);
    expect(calls).toContainEqual({ method: "list", input: filters });
  });

  test("creates a requirement only for valid game, platform, and source refs", async () => {
    const { repository, calls } = freshRepository();
    const service = new GameSystemRequirementService(repository);

    const input = {
      gameUnitId: "game-1",
      platformEntityId: "platform-windows",
      tier: "recommended",
      language: "en",
      sourceRefId: "source-ref-1",
      hardware: { memory: "16 GB" },
      rawText: "Recommended specs",
    } as const;
    await service.create(input);

    expect(calls).toContainEqual({ method: "findGame", input: "game-1" });
    expect(calls).toContainEqual({
      method: "findPlatformEntity",
      input: "platform-windows",
    });
    expect(calls).toContainEqual({
      method: "findSourceRef",
      input: "source-ref-1",
    });
    expect(calls).toContainEqual({ method: "create", input });
  });

  test("rejects non-platform entities", async () => {
    const { repository } = freshRepository();
    repository.findPlatformEntity = async () => ({
      kind: "organization",
      eligibleSubjectRoles: [],
    });
    const service = new GameSystemRequirementService(repository);

    await expect(
      service.create({
        gameUnitId: "game-1",
        platformEntityId: "entity-1",
        tier: "minimum",
        hardware: {},
      }),
    ).rejects.toThrow(/game_platform/);
  });

  test("rejects requirement source refs for another unit", async () => {
    const { repository } = freshRepository();
    repository.findSourceRef = async (sourceRefId: string) => ({
      id: sourceRefId,
      unitId: "other-game",
    });
    const service = new GameSystemRequirementService(repository);

    await expect(
      service.create({
        gameUnitId: "game-1",
        platformEntityId: "platform-windows",
        tier: "minimum",
        sourceRefId: "source-ref-1",
        hardware: {},
      }),
    ).rejects.toThrow(/same game Unit/);
  });

  test("maps storage rows to contract DTOs", () => {
    const dto = mapGameSystemRequirementToDTO(requirementRow() as any);

    expect(dto).toEqual({
      id: "req-1",
      gameUnitId: "game-1",
      platformEntityId: "platform-windows",
      tier: "minimum",
      language: "en",
      sourceRefId: "source-ref-1",
      hardware: { memory: "8 GB" },
      rawText: "Requires a 64-bit processor and operating system.",
      createdAt: now,
      updatedAt: now,
    });
  });
});
