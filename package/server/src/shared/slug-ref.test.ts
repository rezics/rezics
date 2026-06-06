import { describe, expect, mock, test } from "bun:test";

const TAG_SCOPE_ID = "11111111-1111-1111-1111-111111111111";
const USER_SCOPE_ID = "22222222-2222-2222-2222-222222222222";

mock.module("../infra/slug-scopes", () => ({
  getSlugScopeId: (name: string) =>
    name === "tag" ? TAG_SCOPE_ID : name === "user" ? USER_SCOPE_ID : null,
  requireSlugScopeId: (name: string) => {
    if (name === "tag") return TAG_SCOPE_ID;
    if (name === "user") return USER_SCOPE_ID;
    throw new Error(`missing scope: ${name}`);
  },
}));

async function loadSlugRef() {
  return import("./slug-ref");
}

function repository(result: string | null = null) {
  return {
    findUnitIdBySlug: mock(async () => result),
  };
}

describe("resolveSlugRef", () => {
  test("returns unitId directly when present", async () => {
    const { resolveSlugRef } = await loadSlugRef();
    const result = await resolveSlugRef({
      scope: "tag",
      slug: "light-novel",
      unitId: "uuid-123",
    });
    expect(result).toBe("uuid-123");
  });

  test("looks up by (slugScope, slug) when unitId is absent", async () => {
    const { resolveSlugRef } = await loadSlugRef();
    const repo = repository("resolved-uuid");

    const result = await resolveSlugRef(
      { scope: "tag", slug: "light-novel" },
      repo,
    );
    expect(result).toBe("resolved-uuid");
    expect(repo.findUnitIdBySlug).toHaveBeenCalledWith({
      slugScope: TAG_SCOPE_ID,
      slug: "light-novel",
    });
  });

  test("returns null for non-existent slug", async () => {
    const { resolveSlugRef } = await loadSlugRef();
    const repo = repository();

    const result = await resolveSlugRef(
      {
        scope: "tag",
        slug: "does-not-exist",
      },
      repo,
    );
    expect(result).toBeNull();
  });

  test("defaults TagRef (no scope) to the tag scope", async () => {
    const { resolveSlugRef } = await loadSlugRef();
    const repo = repository("tag-uuid");

    const result = await resolveSlugRef({ slug: "novel" }, repo);
    expect(result).toBe("tag-uuid");
    expect(repo.findUnitIdBySlug).toHaveBeenLastCalledWith({
      slugScope: TAG_SCOPE_ID,
      slug: "novel",
    });
  });
});

describe("resolveSlugRefs", () => {
  test("resolves mixed refs and filters out nulls", async () => {
    const { resolveSlugRefs } = await loadSlugRef();
    const repo = repository();

    const result = await resolveSlugRefs(
      [
        { scope: "tag", slug: "a", unitId: "uuid-1" },
        { scope: "tag", slug: "missing" },
      ],
      repo,
    );

    expect(result).toEqual(["uuid-1"]);
  });

  test("returns empty array for empty input", async () => {
    const { resolveSlugRefs } = await loadSlugRef();
    const result = await resolveSlugRefs([]);
    expect(result).toEqual([]);
  });
});
