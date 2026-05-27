import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const unitFindUniqueMock = mock(async () => ({
  id: "work-1",
  type: "BOOK",
  translations: [{ unitId: "work-1", language: "en", title: "Work" }],
  workMembers: [{ unitId: "release-1" }],
}));

Object.assign(prismaMock, {
  unit: {
    findUnique: unitFindUniqueMock,
  },
});

mock.module("@/unit", () => ({
  translationService: {
    upsertTranslation: mock(async () => ({
      unitId: "work-1",
      language: "en",
      title: "Work",
    })),
  },
}));

const { WorkMaintenanceService } = await import("./work-maintenance.service");

describe("WorkMaintenanceService", () => {
  const service = new WorkMaintenanceService();

  beforeEach(() => {
    unitFindUniqueMock.mockClear();
    unitFindUniqueMock.mockImplementation(async () => ({
      id: "work-1",
      type: "BOOK",
      translations: [{ unitId: "work-1", language: "en", title: "Work" }],
      workMembers: [{ unitId: "release-1" }],
    }));
  });

  test("reads abstract Work identity by Unit id", async () => {
    await expect(service.get("work-1")).resolves.toEqual({
      unitId: "work-1",
      type: "BOOK",
      translations: [
        expect.objectContaining({
          unitId: "work-1",
          language: "en",
          title: "Work",
        }),
      ],
      releaseUnitIds: ["release-1"],
    });
  });

  test("rejects ordinary release Units as Work maintenance targets", async () => {
    unitFindUniqueMock.mockImplementationOnce(async () => ({
      id: "release-1",
      type: "BOOK",
      translations: [],
      workMembers: [],
    }));

    await expect(service.get("release-1")).rejects.toThrow(/Work Unit/);
  });
});
