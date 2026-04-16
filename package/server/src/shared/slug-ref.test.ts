import { describe, expect, mock, test } from "bun:test";
import { resolveSlugRef, resolveSlugRefs } from "./slug-ref";

// Mock prisma
const mockFindUnique = mock(() => Promise.resolve(null));
mock.module("#/prisma/client", () => ({
  prisma: {
    unit: {
      findUnique: mockFindUnique,
    },
  },
}));

describe("resolveSlugRef", () => {
  test("returns unitId directly when present", async () => {
    const result = await resolveSlugRef({
      slug: "light-novel",
      unitId: "uuid-123",
    });
    expect(result).toBe("uuid-123");
  });

  test("looks up by slug when unitId is absent", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "resolved-uuid" } as any);

    const result = await resolveSlugRef({ slug: "light-novel" });
    expect(result).toBe("resolved-uuid");
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { slug: "light-novel" },
      select: { id: true },
    });
  });

  test("returns null for non-existent slug", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await resolveSlugRef({ slug: "does-not-exist" });
    expect(result).toBeNull();
  });
});

describe("resolveSlugRefs", () => {
  test("resolves mixed refs and filters out nulls", async () => {
    mockFindUnique.mockResolvedValueOnce(null); // "missing" not found

    const result = await resolveSlugRefs([
      { slug: "a", unitId: "uuid-1" },
      { slug: "missing" },
    ]);

    expect(result).toEqual(["uuid-1"]);
  });

  test("returns empty array for empty input", async () => {
    const result = await resolveSlugRefs([]);
    expect(result).toEqual([]);
  });
});
