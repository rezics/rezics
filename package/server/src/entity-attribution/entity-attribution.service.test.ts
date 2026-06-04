import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { RezicsSessionClaims } from "@rezics/contract";
import type {
  EntityAttributionBatchRepository,
  EntityAttributionBatchService,
} from "./entity-attribution.service";

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
mock.module("../job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const actor = (role: "ADMIN" | "USER" = "ADMIN"): RezicsSessionClaims => ({
  tokenType: "member-session",
  sub: "auth-1",
  userId: "user-1",
  permission: { role },
  iss: "rezics-server",
  exp: 1,
  iat: 1,
});

function createRepository(
  options: {
    existingCredits?: Array<{ entityId: string; sortOrder: number }>;
    existingSubjects?: Array<{
      entityId: string;
      sortOrder: number;
      weight: number | null;
    }>;
    eligibleCreditRoles?: string[];
    eligibleSubjectRoles?: string[];
    locked?: boolean;
  } = {},
) {
  const txRepository: EntityAttributionBatchRepository = {
    listCreditEligibility: mock(async (entityIds: readonly string[]) =>
      entityIds.map((unitId) => ({
        unitId,
        eligibleCreditRoles: options.eligibleCreditRoles ?? ["author"],
      })),
    ),
    listSubjectEligibility: mock(async (entityIds: readonly string[]) =>
      entityIds.map((unitId) => ({
        unitId,
        eligibleSubjectRoles: options.eligibleSubjectRoles ?? [
          "primary_character",
        ],
      })),
    ),
    listCreditRows: mock(async () => options.existingCredits ?? []),
    listSubjectRows: mock(async () => options.existingSubjects ?? []),
    replaceCredits: mock(async () => {}),
    replaceSubjects: mock(async () => {}),
    assertCanEdit: mock(async () => {
      if (options.locked) throw new Error("locked");
    }),
    writeHistory: mock(async () => {}),
    loadState: mock(async () => ({
      credits: [
        {
          unitId: "book-1",
          entityId: "entity-b",
          role: "author",
          sortOrder: 0,
        } as any,
      ],
      subjects: [
        {
          unitId: "book-1",
          entityId: "character-1",
          role: "primary_character",
          sortOrder: 0,
          weight: 0.8,
        } as any,
      ],
    })),
    transaction: mock(async () => {
      throw new Error("nested transaction is not used in tx repository");
    }),
  };

  const repository: EntityAttributionBatchRepository = {
    ...txRepository,
    loadState: mock(async () => txRepository.loadState("book-1")),
    transaction: mock(async (callback) => callback(txRepository)),
  };

  return { repository, txRepository };
}

async function createService(repository: EntityAttributionBatchRepository) {
  const { EntityAttributionBatchService } = await import(
    "./entity-attribution.service"
  );
  return new EntityAttributionBatchService(repository);
}

beforeEach(() => {
  enqueueMock.mockClear();
});

describe("EntityAttributionBatchService.batchUpdate", () => {
  test("commits mixed credit and subject changes with one history row", async () => {
    const { repository, txRepository } = createRepository({
      existingCredits: [
        { entityId: "entity-a", sortOrder: 0 },
        { entityId: "entity-b", sortOrder: 1 },
      ],
      existingSubjects: [],
    });
    const service = await createService(repository);

    const result = await service.batchUpdate(
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
    expect(txRepository.replaceCredits).toHaveBeenCalledTimes(1);
    expect(txRepository.replaceSubjects).toHaveBeenCalledTimes(1);
    expect(txRepository.writeHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "entity-attribution.batch",
        patch: {
          credits: { authors: expect.any(Array) },
          subjects: { primary_character: expect.any(Array) },
        },
      }),
    );
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchCredits",
      "search.content.patchSubjects",
    ]);
  });

  test("rolls back validation failures before canonical row or history writes", async () => {
    const { repository, txRepository } = createRepository({
      eligibleCreditRoles: ["translator"],
    });
    const service = await createService(repository);

    await expect(
      service.batchUpdate(
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

    expect(txRepository.replaceCredits).not.toHaveBeenCalled();
    expect(txRepository.writeHistory).not.toHaveBeenCalled();
  });

  test("returns success for no-op batches without history or search writes", async () => {
    const { repository, txRepository } = createRepository({
      existingCredits: [{ entityId: "entity-a", sortOrder: 0 }],
    });
    const service = await createService(repository);

    const result = await service.batchUpdate(
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
    expect(txRepository.writeHistory).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  test("rejects locked authority paths before canonical mutation", async () => {
    const { repository, txRepository } = createRepository({ locked: true });
    const service = await createService(repository);

    await expect(
      service.batchUpdate(
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

    expect(txRepository.replaceCredits).not.toHaveBeenCalled();
    expect(txRepository.writeHistory).not.toHaveBeenCalled();
  });
});
