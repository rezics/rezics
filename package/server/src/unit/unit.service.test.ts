import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock } from "../test/prisma-client-mock";

installPrismaClientMock();
mock.module("@/content-doc/prisma-json", () => ({
  nullableContentDocJson: (value: unknown) => value ?? null,
}));
mock.module("@/infra/slug-scopes", () => ({
  pickSlugScope: () => "global",
}));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: mock(async () => ({ status: "created" })),
  },
}));
mock.module("@/reaction-boundary/reaction-boundary.client", () => ({
  cleanupReactions: mock(async () => undefined),
}));
mock.module("@/utils/userSlugHydration", () => ({
  hydrateUnitOwnerUserSlugRow: async (row: unknown) => row,
  hydrateUnitOwnerUserSlugs: async (rows: unknown) => rows,
}));
mock.module("@/utils/sanitizeUser", () => ({
  publicUserSelect: {},
}));
mock.module("@/utils/errors", () => ({
  AppError: class AppError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const { buildUnitWhereClause } = await import("./unit.service");

describe("buildUnitWhereClause", () => {
  test("ignores removed work-domain unit filters", () => {
    expect(buildUnitWhereClause({ workUnitId: "work-1" })).toEqual({
      AND: [
        {
          NOT: {
            type: "LABEL",
          },
        },
      ],
    });
  });

  test("searches operator lookup fields and structured filters", () => {
    expect(
      buildUnitWhereClause({
        q: "spice",
        id: "unit-1",
        slug: "dune",
        title: "Dune",
        type: "BOOK",
        userId: "owner-1",
        status: "PUBLISHED",
        visibility: "PUBLIC",
      }),
    ).toEqual({
      AND: [
        {
          OR: [
            { id: { contains: "spice", mode: "insensitive" } },
            { slug: { contains: "spice", mode: "insensitive" } },
            {
              translations: {
                some: {
                  title: { contains: "spice", mode: "insensitive" },
                },
              },
            },
          ],
        },
        { id: { contains: "unit-1", mode: "insensitive" } },
        { slug: { contains: "dune", mode: "insensitive" } },
        {
          translations: {
            some: {
              title: { contains: "Dune", mode: "insensitive" },
            },
          },
        },
        { type: { in: ["BOOK"] } },
        { status: { in: ["PUBLISHED"] } },
        { visibility: "PUBLIC" },
        { userId: { in: ["owner-1"] } },
      ],
    });
  });
});
