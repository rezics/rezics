import { beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  UnitAliasRepository,
  UnitAliasService,
} from "./unit-alias.service";

process.env.NODE_ENV = "test";

const hasAuthorityOverMock = mock(async () => true);
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));

mock.module("../unit/authority", () => ({
  hasAuthorityOver: hasAuthorityOverMock,
}));
mock.module("../middleware", () => ({
  isAdminRole: () => false,
  verifyAdminFromDb: async () => false,
}));
mock.module("../job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const now = new Date("2026-01-01T00:00:00.000Z");

function aliasRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "alias-1",
    unitId: "unit-1",
    value: "3 Body Problem",
    normalizedValue: "3 body problem",
    language: null,
    kind: "COMMON",
    status: "ACTIVE",
    score: 1,
    voteCount: 1,
    pinned: false,
    position: null,
    createdById: "user-1",
    updatedById: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as any;
}

function createRepository() {
  const repository: UnitAliasRepository = {
    list: mock(async () => ({
      aliases: [aliasRow()],
      total: 1,
    })),
    create: mock(async (userId, input, normalized) =>
      aliasRow({
        unitId: input.unitId,
        value: normalized.value,
        normalizedValue: normalized.normalizedValue,
        language: input.language ?? null,
        kind: input.kind ?? "COMMON",
        createdById: userId,
        updatedById: userId,
      }),
    ),
    update: mock(async (_aliasId, data) => aliasRow(data)),
    castVote: mock(async (_userId, _aliasId, value) =>
      aliasRow({ score: value, voteCount: 1 }),
    ),
    delete: mock(async () => {}),
    getAlias: mock(async () => aliasRow()),
    getUnitAuthority: mock(async () => ({ id: "unit-1", userId: "owner-1" })),
  };
  return repository;
}

const actor = {
  userId: "owner-1",
  permission: { role: "USER" },
} as any;

const { normalizeUnitAliasValue } = await import("./normalizer");

async function createService(repository: UnitAliasRepository) {
  const { UnitAliasService } = await import("./unit-alias.service");
  return new UnitAliasService(repository);
}

describe("normalizeUnitAliasValue", () => {
  test("uses conservative normalization", () => {
    expect(normalizeUnitAliasValue("  ＴＢＰ　—  Book  ")).toBe("tbp - book");
  });
});

describe("UnitAliasService", () => {
  let repository: UnitAliasRepository;
  let service: UnitAliasService;

  beforeEach(async () => {
    repository = createRepository();
    service = await createService(repository);
    enqueueMock.mockClear();
    hasAuthorityOverMock.mockClear();
    hasAuthorityOverMock.mockResolvedValue(true);
  });

  test("create de-duplicates by unitId and normalizedValue", async () => {
    await service.create("user-1", {
      unitId: "unit-1",
      value: "  ＴＢＰ  ",
      kind: "ABBREVIATION",
    });

    expect(repository.create).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ unitId: "unit-1", kind: "ABBREVIATION" }),
      { value: "TBP", normalizedValue: "tbp" },
    );
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchAliases",
      "search.entity.patchAliases",
      "search.realm.patchAliases",
      "search.tag.patchAliases",
      "search.label.patchAliases",
    ]);
  });

  test("castVote normalizes one vote and returns recalculated alias", async () => {
    await service.castVote("user-1", "alias-1", -10);

    expect(repository.castVote).toHaveBeenCalledWith("user-1", "alias-1", -10);
    const alias = await service.castVote("user-1", "alias-1", 10);
    expect(alias.score).toBe(10);
  });

  test("pinning is authority-gated and does not change score", async () => {
    await service.setPin("alias-1", { pinned: true, position: "a0" }, actor);

    expect(repository.update).toHaveBeenCalledWith("alias-1", {
      pinned: true,
      position: "a0",
      updatedById: "owner-1",
    });
  });

  test("regular users cannot manage aliases without authority", async () => {
    hasAuthorityOverMock.mockResolvedValueOnce(false);

    await expect(
      service.setPin("alias-1", { pinned: true }, actor),
    ).rejects.toThrow("Unit alias management requires admin or unit authority");
  });

  test("hide and delete use management paths", async () => {
    await service.hide("alias-1", actor);
    await service.delete("alias-1", actor);

    expect(repository.update).toHaveBeenCalledWith(
      "alias-1",
      expect.objectContaining({ status: "HIDDEN" }),
    );
    expect(repository.delete).toHaveBeenCalledWith("alias-1");
  });
});
