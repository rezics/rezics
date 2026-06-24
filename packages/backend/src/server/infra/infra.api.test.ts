import { describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

describe("infra bootstrap endpoint", () => {
  test("returns seed tag ids, default realm id, and slug scopes from caches", async () => {
    mock.module("./default-realm", () => ({
      getDefaultRealmId: () => "realm-uuid-1",
    }));
    mock.module("./seed-tags", () => ({
      getSeedTagsSnapshot: () => ({
        book: "tag-book",
        game: "tag-game",
        media: "tag-media",
        post: "tag-post",
        link: "tag-link",
      }),
    }));
    mock.module("./slug-scopes", () => ({
      getSlugScopesSnapshot: () => ({
        user: "scope-user",
        realm: "scope-realm",
        tag: "scope-tag",
        zone: "scope-zone",
        entity: "scope-entity",
      }),
    }));

    const { infraApi } = await import("./infra.api");
    const response = await infraApi.handle(
      new Request("http://localhost/infra/bootstrap"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      seedTags: {
        book: "tag-book",
        game: "tag-game",
        media: "tag-media",
        post: "tag-post",
        link: "tag-link",
      },
      slugScopes: {
        user: "scope-user",
        realm: "scope-realm",
        tag: "scope-tag",
        zone: "scope-zone",
        entity: "scope-entity",
      },
      defaultRealmId: "realm-uuid-1",
    });
  });

  test("omits defaultRealmId when cache is empty", async () => {
    mock.module("./default-realm", () => ({
      getDefaultRealmId: () => null,
    }));
    mock.module("./seed-tags", () => ({
      getSeedTagsSnapshot: () => ({ book: "tag-book" }),
    }));
    mock.module("./slug-scopes", () => ({
      getSlugScopesSnapshot: () => ({}),
    }));

    const { infraApi } = await import("./infra.api");
    const response = await infraApi.handle(
      new Request("http://localhost/infra/bootstrap"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ seedTags: { book: "tag-book" }, slugScopes: {} });
    expect(body.defaultRealmId).toBeUndefined();
  });
});
