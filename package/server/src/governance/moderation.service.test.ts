import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

const now = new Date("2026-05-28T00:00:00.000Z");
const contentModerationUpsert = mock(async ({ create, update }: any) => ({
  targetUnitId: create?.targetUnitId ?? "post-1",
  ...(update ?? create),
  createdAt: now,
  updatedAt: now,
}));
const contentModerationFindUnique = mock(async () => null);
const realmContentModerationUpsert = mock(async ({ create, update }: any) => ({
  realmUnitId: create?.realmUnitId ?? "realm-1",
  targetUnitId: create?.targetUnitId ?? "reply-1",
  ...(update ?? create),
  createdAt: now,
  updatedAt: now,
}));
const realmContentModerationFindMany = mock(async () => [
  {
    realmUnitId: "realm-1",
    targetUnitId: "reply-1",
    state: "TOMBSTONED",
    decidedById: "mod-1",
    caseId: null,
    reason: "off-topic",
    metadata: null,
    createdAt: now,
    updatedAt: now,
  },
]);

Object.assign(prismaMock, {
  contentModerationState: {
    findUnique: contentModerationFindUnique,
    upsert: contentModerationUpsert,
  },
  realmContentModeration: {
    findMany: realmContentModerationFindMany,
    upsert: realmContentModerationUpsert,
  },
});

describe("GovernanceModerationService content moderation state", () => {
  beforeEach(() => {
    contentModerationFindUnique.mockClear();
    contentModerationUpsert.mockClear();
    realmContentModerationFindMany.mockClear();
    realmContentModerationUpsert.mockClear();
  });

  test("upserts global content moderation state", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.setGlobalContentState({
      targetUnitId: "reply-1",
      state: "hidden",
      decidedById: "staff-1",
      reason: "abuse",
    });

    expect(contentModerationUpsert).toHaveBeenCalledWith({
      where: { targetUnitId: "reply-1" },
      create: expect.objectContaining({
        targetUnitId: "reply-1",
        state: "HIDDEN",
        decidedById: "staff-1",
        reason: "abuse",
      }),
      update: expect.objectContaining({
        state: "HIDDEN",
        decidedById: "staff-1",
        reason: "abuse",
      }),
    });
    expect(result).toMatchObject({
      targetUnitId: "reply-1",
      state: "hidden",
      decidedByUserId: "staff-1",
      reason: "abuse",
    });
  });

  test("lists realm overlays bounded to requested node ids", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.listRealmContentOverlays({
      realmUnitId: "realm-1",
      targetUnitIds: ["reply-1", "reply-1", "reply-2"],
    });

    expect(realmContentModerationFindMany).toHaveBeenCalledWith({
      where: {
        realmUnitId: "realm-1",
        targetUnitId: { in: ["reply-1", "reply-2"] },
      },
      orderBy: { updatedAt: "desc" },
    });
    expect(result).toEqual([
      {
        realmUnitId: "realm-1",
        targetUnitId: "reply-1",
        state: "tombstoned",
        decidedByUserId: "mod-1",
        caseId: null,
        reason: "off-topic",
        metadata: undefined,
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      },
    ]);
  });

  test("upserts sparse realm content overlay by realm and target", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.setRealmContentOverlay({
      realmUnitId: "realm-1",
      targetUnitId: "reply-1",
      state: "tombstoned",
      decidedById: "mod-1",
      reason: "off-topic",
    });

    expect(realmContentModerationUpsert).toHaveBeenCalledWith({
      where: {
        realmUnitId_targetUnitId: {
          realmUnitId: "realm-1",
          targetUnitId: "reply-1",
        },
      },
      create: expect.objectContaining({
        realmUnitId: "realm-1",
        targetUnitId: "reply-1",
        state: "TOMBSTONED",
      }),
      update: expect.objectContaining({
        state: "TOMBSTONED",
        decidedById: "mod-1",
      }),
    });
    expect(result).toMatchObject({
      realmUnitId: "realm-1",
      targetUnitId: "reply-1",
      state: "tombstoned",
    });
  });
});
