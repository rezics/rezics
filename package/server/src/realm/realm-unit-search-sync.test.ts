import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "@/test/prisma-client-mock";

installPrismaClientMock();

const realmUnitCreateMock = mock(async ({ data }: any) => data);
const realmUnitDeleteMock = mock(async () => ({}));
const realmUnitFindManyMock = mock(async () => [
  { realmUnitId: "realm-1" },
  { realmUnitId: "realm-2" },
]);
const patchContentRealmIdsToMeiliMock = mock(async () => undefined);
const patchPostFieldsToMeiliMock = mock(async () => undefined);

Object.assign(prismaMock, {
  realmUnit: {
    create: realmUnitCreateMock,
    delete: realmUnitDeleteMock,
    findMany: realmUnitFindManyMock,
  },
});

mock.module("@/meili/content/sync", () => ({
  deleteContentFromMeili: async () => undefined,
  patchContentCreditsToMeili: async () => undefined,
  patchContentMetadataToMeili: async () => undefined,
  patchContentTagsToMeili: async () => undefined,
  patchContentTranslationsToMeili: async () => undefined,
  patchContentRealmIdsToMeili: patchContentRealmIdsToMeiliMock,
  patchContentRealmTagKeysToMeili: async () => undefined,
  syncContentToMeili: async () => undefined,
}));

mock.module("@/meili/post/sync", () => ({
  deletePostFromMeili: async () => undefined,
  patchPostFieldsToMeili: patchPostFieldsToMeiliMock,
  patchPostsAuthorToMeili: async () => undefined,
  patchPostsTargetToMeili: async () => undefined,
  syncAllPostsToMeili: async () => undefined,
  syncPostToMeili: async () => undefined,
  syncPostsByAuthorToMeili: async () => undefined,
  syncPostsByTargetToMeili: async () => undefined,
}));

mock.module("@/meili/realm/sync", () => ({
  deleteRealmFromMeili: async () => undefined,
  patchRealmMemberCountToMeili: async () => undefined,
  patchRealmMetadataToMeili: async () => undefined,
  patchRealmTranslationsToMeili: async () => undefined,
  syncAllRealmsToMeili: async () => undefined,
  syncRealmToMeili: async () => undefined,
}));

const { RealmService } = await import("./realm.service");

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

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
    patchContentRealmIdsToMeiliMock.mockClear();
    patchPostFieldsToMeiliMock.mockClear();
  });

  test("adding a RealmUnit patches the post realmIds field", async () => {
    await service.addRealmUnit("realm-1", "post-1");
    await flushMicrotasks();

    expect(patchPostFieldsToMeiliMock).toHaveBeenCalledWith("post-1", {
      realmIds: ["realm-1", "realm-2"],
    });
  });

  test("removing a RealmUnit patches the post realmIds field", async () => {
    realmUnitFindManyMock.mockResolvedValueOnce([{ realmUnitId: "realm-2" }]);

    await service.removeRealmUnit("realm-1", "post-1");
    await flushMicrotasks();

    expect(patchPostFieldsToMeiliMock).toHaveBeenCalledWith("post-1", {
      realmIds: ["realm-2"],
    });
  });
});
