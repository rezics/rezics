import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { RezicsSessionClaims } from "@rezics/contract";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

mock.module("@/middleware", () => ({
  isAdminRole: (identity: RezicsSessionClaims | null) =>
    identity?.permission.role === "ADMIN" ||
    identity?.permission.role === "ROOT",
  verifyAdminFromDb: async () => false,
}));

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const now = new Date("2026-05-24T00:00:00.000Z");

const actor = (role: "ADMIN" | "USER" = "ADMIN"): RezicsSessionClaims => ({
  tokenType: "member-session",
  sub: "auth-1",
  userId: "user-1",
  permission: { role },
  iss: "rezics-server",
  exp: 1,
  iat: 1,
});

function entityUnit(entityId: string, title = entityId) {
  return {
    id: entityId,
    type: "ENTITY",
    slug: title,
    userId: "user-1",
    createdAt: now,
    updatedAt: now,
    entity: {
      kind: "person",
      verified: false,
      eligibleCreditRoles: ["author"],
      eligibleSubjectRoles: ["primary_character"],
    },
    translations: [
      {
        unitId: entityId,
        language: "en",
        title,
        subtitle: null,
        summary: null,
        description: null,
        extra: null,
        sourceReleaseUnitId: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function creditRow(entityId: string, sortOrder: number) {
  return {
    unitId: "book-1",
    entityId,
    role: "author",
    sortOrder,
    entity: entityUnit(entityId),
  };
}

function subjectRow(
  entityId: string,
  sortOrder: number,
  weight: number | null = null,
) {
  return {
    unitId: "book-1",
    entityId,
    role: "primary_character",
    sortOrder,
    weight,
    entity: entityUnit(entityId),
    unit: {
      id: "book-1",
      type: "BOOK",
      slug: null,
      userId: "user-1",
      workUnitId: null,
      defaultLanguage: "en",
      isLanguageNeutral: false,
      translationGroupId: null,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      rating: "GENERAL",
      extra: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      translations: [],
      supportLanguages: [],
    },
  };
}

function makeTx(
  options: {
    existingCredits?: Array<{ entityId: string; sortOrder: number }>;
    existingSubjects?: Array<{
      entityId: string;
      sortOrder: number;
      weight: number | null;
    }>;
    eligibleCreditRoles?: string[];
    eligibleSubjectRoles?: string[];
    locks?: Array<{ path: string }>;
  } = {},
) {
  const tx = {
    $queryRaw: mock(async () => [{ sequence: 1n }]),
    unit: {
      findUniqueOrThrow: mock(async () => ({
        id: "book-1",
        userId: "owner-1",
      })),
    },
    unitCollaborator: {
      findUnique: mock(async () => null),
    },
    unitFieldLock: {
      findMany: mock(async () => options.locks ?? []),
    },
    historyOutbox: {
      create: mock(async (args: any) => args.data),
    },
    entity: {
      findMany: mock(async ({ where }: any) =>
        where.unitId.in.map((unitId: string) => ({
          unitId,
          eligibleCreditRoles: options.eligibleCreditRoles ?? ["author"],
          eligibleSubjectRoles: options.eligibleSubjectRoles ?? [
            "primary_character",
          ],
        })),
      ),
    },
    creditAttribution: {
      findMany: mock(async (args: any) =>
        args.include
          ? [creditRow("entity-b", 0), creditRow("entity-c", 1)]
          : (options.existingCredits ?? []).map((row) => ({ ...row })),
      ),
      deleteMany: mock(async () => ({ count: 1 })),
      upsert: mock(async () => ({})),
    },
    subjectAttribution: {
      findMany: mock(async (args: any) =>
        args.include
          ? [subjectRow("character-1", 0, 0.8)]
          : (options.existingSubjects ?? []).map((row) => ({ ...row })),
      ),
      deleteMany: mock(async () => ({ count: 1 })),
      upsert: mock(async () => ({})),
    },
  };

  Object.assign(prismaMock, {
    $transaction: mock(async (callback: (inner: typeof tx) => unknown) =>
      callback(tx),
    ),
  });

  return tx;
}

beforeEach(() => {
  enqueueMock.mockClear();
});

describe("EntityAttributionBatchService.batchUpdate", () => {
  test("commits mixed credit and subject changes with one history row", async () => {
    const tx = makeTx({
      existingCredits: [
        { entityId: "entity-a", sortOrder: 0 },
        { entityId: "entity-b", sortOrder: 1 },
      ],
      existingSubjects: [],
    });
    const { entityAttributionBatchService } = await import(
      "./entity-attribution.service"
    );

    const result = await entityAttributionBatchService.batchUpdate(
      "book-1",
      {
        ops: [
          {
            op: "setCredits",
            role: "author",
            entries: [
              { entityId: "entity-b", sortOrder: 0 },
              { entityId: "entity-c", sortOrder: 1 },
            ],
          },
          {
            op: "setSubjects",
            role: "primary_character",
            entries: [{ entityId: "character-1", weight: 0.8 }],
          },
        ],
      },
      actor(),
    );

    expect(result.changed).toBe(true);
    expect(tx.creditAttribution.upsert).toHaveBeenCalledTimes(2);
    expect(tx.subjectAttribution.upsert).toHaveBeenCalledTimes(1);
    expect(tx.historyOutbox.create).toHaveBeenCalledTimes(1);
    expect(
      tx.historyOutbox.create.mock.calls[0]?.[0].data.payload,
    ).toMatchObject({
      revision: {
        message: "entity-attribution.batch",
        patch: {
          credits: { authors: expect.any(Array) },
          subjects: { primary_character: expect.any(Array) },
        },
      },
    });
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchCredits",
      "search.content.patchSubjects",
    ]);
  });

  test("rolls back validation failures before canonical row or history writes", async () => {
    const tx = makeTx({ eligibleCreditRoles: ["translator"] });
    const { entityAttributionBatchService } = await import(
      "./entity-attribution.service"
    );

    await expect(
      entityAttributionBatchService.batchUpdate(
        "book-1",
        {
          ops: [
            {
              op: "setCredits",
              role: "author",
              entries: [{ entityId: "entity-a" }],
            },
          ],
        },
        actor(),
      ),
    ).rejects.toThrow(/not eligible for credit role/);

    expect(tx.creditAttribution.deleteMany).not.toHaveBeenCalled();
    expect(tx.creditAttribution.upsert).not.toHaveBeenCalled();
    expect(tx.historyOutbox.create).not.toHaveBeenCalled();
  });

  test("returns success for no-op batches without history or search writes", async () => {
    const tx = makeTx({
      existingCredits: [{ entityId: "entity-a", sortOrder: 0 }],
    });
    const { entityAttributionBatchService } = await import(
      "./entity-attribution.service"
    );

    const result = await entityAttributionBatchService.batchUpdate(
      "book-1",
      {
        ops: [
          {
            op: "setCredits",
            role: "author",
            entries: [{ entityId: "entity-a", sortOrder: 0 }],
          },
        ],
      },
      actor(),
    );

    expect(result.changed).toBe(false);
    expect(tx.historyOutbox.create).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  test("rejects locked authority paths before canonical mutation", async () => {
    const tx = makeTx({ locks: [{ path: "credits.authors" }] });
    const { entityAttributionBatchService } = await import(
      "./entity-attribution.service"
    );

    await expect(
      entityAttributionBatchService.batchUpdate(
        "book-1",
        {
          ops: [
            {
              op: "setCredits",
              role: "author",
              entries: [{ entityId: "entity-a" }],
            },
          ],
        },
        actor("USER"),
      ),
    ).rejects.toThrow(/locked/);

    expect(tx.creditAttribution.upsert).not.toHaveBeenCalled();
    expect(tx.historyOutbox.create).not.toHaveBeenCalled();
  });
});
