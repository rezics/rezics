import { describe, expect, test } from "bun:test";
import type { RealmDTO } from "@rezics/contract";
import { loadRealmSlugRoute } from "./realmSlugRoute";

const realm = {
  unitId: "realm-unit-id",
  slug: "rezics",
  isPublic: true,
  isOfficial: false,
  memberCount: 1,
} as RealmDTO;

describe("loadRealmSlugRoute", () => {
  test("resolves slug route params to a realm without canonicalizing to unit-id routes", async () => {
    const queryKeys: (readonly unknown[])[] = [];
    const queryClient = {
      ensureQueryData: async (query: { queryKey: readonly unknown[] }) => {
        queryKeys.push(query.queryKey);
        return realm;
      },
    };

    await expect(
      loadRealmSlugRoute({
        params: { realmSlug: "rezics" },
        queryClient: queryClient as never,
      }),
    ).resolves.toEqual({
      realm,
      readContext: { appLocale: "zh-hant", languages: [] },
    });
    expect(queryKeys[0]).toContain("by-slug");
    expect(queryKeys[0]).toContain("rezics");
    expect(queryKeys[1]).toContain("detail");
    expect(queryKeys[1]).toContain("realm-unit-id");
  });

  test("rejects non-slug route params", async () => {
    const queryClient = {
      ensureQueryData: async () => realm,
    };

    await expect(
      loadRealmSlugRoute({
        params: {},
        queryClient: queryClient as never,
      }),
    ).rejects.toMatchObject({ isNotFound: true });
  });
});
