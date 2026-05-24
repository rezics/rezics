import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const realmUnitCreateMock = mock(async ({ data }: any) => data);
const realmUnitDeleteMock = mock(async () => ({}));
const realmUnitFindManyMock = mock(async () => [
  { realmUnitId: "realm-1" },
  { realmUnitId: "realm-2" },
]);
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));

Object.assign(prismaMock, {
  realmUnit: {
    create: realmUnitCreateMock,
    delete: realmUnitDeleteMock,
    findMany: realmUnitFindManyMock,
  },
});

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const { RealmService } = await import("./realm.service");

describe("RealmUnit post search sync", () => {
  const service = new RealmService();

  beforeEach(() => {
    realmUnitCreateMock.mockClear();
    realmUnitDeleteMock.mockClear();
    realmUnitFindManyMock.mockClear();
    realmUnitFindManyMock.mockResolvedValue([
      { realmUnitId: "realm-1" },
      { realmUnitId: "realm-2" },
    ]);
    enqueueMock.mockClear();
  });

  test("adding a RealmUnit patches the post realmIds field", async () => {
    await service.addRealmUnit("realm-1", "post-1");

    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchRealmIds",
      "search.post.sync",
    ]);
  });

  test("removing a RealmUnit patches the post realmIds field", async () => {
    realmUnitFindManyMock.mockResolvedValueOnce([{ realmUnitId: "realm-2" }]);

    await service.removeRealmUnit("realm-1", "post-1");

    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchRealmIds",
      "search.post.sync",
    ]);
  });
});
