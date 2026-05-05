import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();
Object.assign(prismaMock, {});

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
