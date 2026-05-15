import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";
import { resolveSlugRef, resolveSlugRefs } from "./slug-ref";

const mockFindUnique = mock(() => Promise.resolve(null));
installPrismaClientMock();
Object.assign(prismaMock, {
  unit: {
    findUnique: mockFindUnique,
  },
});

const TAG_SCOPE_ID = "11111111-1111-1111-1111-111111111111";

mock.module("@/infra/slug-scopes", () => ({
  getSlugScopeId: (name: string) => (name === "tag" ? TAG_SCOPE_ID : null),
}));

describe("resolveSlugRef", () => {
  test("returns unitId directly when present", async () => {
    const result = await resolveSlugRef({
      scope: "tag",
      slug: "light-novel",
      unitId: "uuid-123",
    });
    expect(result).toBe("uuid-123");
  });

  test("looks up by (slugScope, slug) when unitId is absent", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "resolved-uuid" } as any);

    const result = await resolveSlugRef({ scope: "tag", slug: "light-novel" });
    expect(result).toBe("resolved-uuid");
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: {
        slugScope_slug: { slugScope: TAG_SCOPE_ID, slug: "light-novel" },
      },
      select: { id: true },
    });
  });

  test("returns null for non-existent slug", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await resolveSlugRef({
      scope: "tag",
      slug: "does-not-exist",
    });
    expect(result).toBeNull();
  });

  test("defaults TagRef (no scope) to the tag scope", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "tag-uuid" } as any);

    const result = await resolveSlugRef({ slug: "novel" });
    expect(result).toBe("tag-uuid");
    expect(mockFindUnique).toHaveBeenLastCalledWith({
      where: { slugScope_slug: { slugScope: TAG_SCOPE_ID, slug: "novel" } },
      select: { id: true },
    });
  });
});

describe("resolveSlugRefs", () => {
  test("resolves mixed refs and filters out nulls", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await resolveSlugRefs([
      { scope: "tag", slug: "a", unitId: "uuid-1" },
      { scope: "tag", slug: "missing" },
    ]);

    expect(result).toEqual(["uuid-1"]);
  });

  test("returns empty array for empty input", async () => {
    const result = await resolveSlugRefs([]);
    expect(result).toEqual([]);
  });
});
