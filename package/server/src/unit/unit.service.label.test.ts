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

describe("buildUnitWhereClause LABEL handling", () => {
  test("excludes LABEL Units from ordinary Unit lists", () => {
    expect(buildUnitWhereClause({})).toEqual({
      AND: [{ NOT: { type: "LABEL" } }],
    });
  });

  test("allows LABEL Units when explicitly requested", () => {
    expect(buildUnitWhereClause({ type: "LABEL" })).toEqual({
      AND: [{ type: { in: ["LABEL"] } }],
    });
  });
});
