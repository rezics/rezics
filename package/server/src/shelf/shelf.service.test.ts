import { describe, expect, mock, test } from "bun:test";

mock.module("#/prisma/client", () => ({
  PostKind: { REVIEW: "REVIEW" },
  UnitStatus: { PUBLISHED: "PUBLISHED" },
  UnitType: {
    BOOK: "BOOK",
    GAME: "GAME",
    MEDIA: "MEDIA",
    POST: "POST",
    TAG: "TAG",
    REALM: "REALM",
    SHELF: "SHELF",
    IMAGE: "IMAGE",
    VIDEO: "VIDEO",
    QUOTE: "QUOTE",
    LINK: "LINK",
  },
  UnitVisibility: {
    PUBLIC: "PUBLIC",
    PRIVATE: "PRIVATE",
  },
  prisma: {},
}));

describe("ShelfService", () => {
  test("rejects reserved system shelf kind keys on create", async () => {
    const { shelfService } = await import("./shelf.service");

    await expect(
      shelfService.create({ title: "Favorites", kindKey: "favorites" }, "u1"),
    ).rejects.toThrow(/reserved/);
    await expect(
      shelfService.create({ title: "Backlog", kindKey: "backlog" }, "u1"),
    ).rejects.toThrow(/reserved/);
  });
});
