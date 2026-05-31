import { describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const cleanupReactionsMock = mock(async () => undefined);
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));
mock.module("@/reaction-boundary/reaction-boundary.client", () => ({
  cleanupReactions: cleanupReactionsMock,
}));
mock.module("@/infra/slug-scopes", () => ({
  getSlugScopeId: () => "global",
  pickSlugScope: () => "global",
  requireSlugScopeId: () => "global",
}));

const { UnitService } = await import("./unit.service");

function resetPrisma() {
  for (const key of Object.keys(prismaMock)) delete prismaMock[key];
  enqueueMock.mockClear();
  cleanupReactionsMock.mockClear();
  const unit = {
    create: mock(async () => ({ id: "unit-1" })),
    update: mock(async () => ({ id: "unit-1" })),
    delete: mock(async () => ({})),
    findMany: mock(async () => []),
    findUnique: mock(async () => ({ slug: "unit-1" })),
    findUniqueOrThrow: mock(async () => ({ id: "unit-1" })),
  };
  prismaMock.unit = {
    ...unit,
  };
  prismaMock.$transaction = mock(async (cb: any) =>
    cb({
      unit,
    }),
  );
}

describe("UnitService search job producers", () => {
  test("create enqueues content sync", async () => {
    resetPrisma();
    const service = new UnitService();

    await service.create({
      userId: "user-1",
      type: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      translations: [],
    } as never);

    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.sync",
      payload: { unitId: "unit-1" },
      source: { type: "server", service: "unit" },
    });
  });

  test("update enqueues content metadata patch", async () => {
    resetPrisma();
    const service = new UnitService();

    await service.update("unit-1", {
      rating: "GENERAL",
      visibility: "PUBLIC",
    } as never);

    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.patchMetadata",
      payload: {
        targetId: "unit-1",
        fields: { rating: "GENERAL", visibility: "PUBLIC" },
      },
    });
  });

  test("delete enqueues content delete and leaves reaction cleanup fire-and-forget", async () => {
    resetPrisma();
    const service = new UnitService();

    await service.delete("unit-1");

    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.delete",
      payload: { unitId: "unit-1" },
    });
    expect(cleanupReactionsMock).toHaveBeenCalledWith("unit-1");
  });
});
