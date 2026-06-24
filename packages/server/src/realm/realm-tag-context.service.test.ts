import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  RealmTagContextError,
  RealmTagContextService,
} from "./realm-tag-context.service";

const contextDate = new Date("2026-01-01T00:00:00Z");

function contextRow(contextUnitId: string | null) {
  return {
    realmUnitId: "realm-1",
    tagUnitId: "tag-1",
    contextUnitId,
    createdAt: contextDate,
    updatedAt: contextDate,
  };
}

const findUnitForType = mock(async (unitId: string) => {
  if (unitId === "realm-1") {
    return {
      id: "realm-1",
      type: "REALM",
      userId: "owner-1",
      realm: { unitId: "realm-1" },
    };
  }
  if (unitId === "tag-1") return { id: "tag-1", type: "TAG" };
  if (unitId === "book-1") return { id: "book-1", type: "BOOK" };
  return null;
});
const isRealmOwner = mock(async (_realmUnitId: string, userId: string) => {
  return userId === "owner-1";
});
const hasRealmContextRole = mock(async () => true);
const findContext = mock(async () => null);
const upsertContext = mock(async (_realmUnitId, _tagUnitId, input) =>
  contextRow(input.contextUnitId ?? null),
);
const materializeContext = mock(async () => contextRow("context-unit-1"));

const repository = {
  findUnitForType,
  isRealmOwner,
  hasRealmContextRole,
  findContext,
  upsertContext,
  materializeContext,
};

const service = new RealmTagContextService(repository);

describe("RealmTagContextService", () => {
  beforeEach(() => {
    findUnitForType.mockClear();
    isRealmOwner.mockClear();
    hasRealmContextRole.mockClear();
    hasRealmContextRole.mockResolvedValue(true);
    findContext.mockClear();
    findContext.mockResolvedValue(null);
    upsertContext.mockClear();
    materializeContext.mockClear();
    materializeContext.mockResolvedValue(contextRow("context-unit-1"));
  });

  test("returns null for a missing context", async () => {
    const row = await service.get("realm-1", "tag-1");

    expect(row).toBeNull();
    expect(findContext).toHaveBeenCalledWith("realm-1", "tag-1");
  });

  test("rejects invalid realm and tag unit types", async () => {
    await expect(
      service.assertRealmAndTagTypes("book-1", "realm-1"),
    ).rejects.toBeInstanceOf(RealmTagContextError);
  });

  test("upserts context metadata", async () => {
    const row = await service.upsert("realm-1", "tag-1", {
      contextUnitId: "context-unit-1",
    });

    expect(row.contextUnitId).toBe("context-unit-1");
    expect(upsertContext).toHaveBeenCalledWith("realm-1", "tag-1", {
      contextUnitId: "context-unit-1",
    });
  });

  test("materializes a context unit through the repository", async () => {
    const row = await service.materialize("user-1", "realm-1", "tag-1");

    expect(materializeContext).toHaveBeenCalledWith({
      callerUserId: "user-1",
      realmUnitId: "realm-1",
      tagUnitId: "tag-1",
    });
    expect(row.contextUnitId).toBe("context-unit-1");
  });

  test("requires moderator-or-owner permission for context writes", async () => {
    isRealmOwner.mockResolvedValueOnce(false);
    hasRealmContextRole.mockResolvedValueOnce(false);

    const allowed = await service.canManageContext(
      { userId: "stranger", permission: { role: "USER" } } as any,
      "realm-1",
    );

    expect(allowed).toBe(false);
  });
});
