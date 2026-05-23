import { describe, expect, mock, test } from "bun:test";
import {
  UnitAuthorityRoleKey,
  type RezicsSessionClaims,
} from "@rezics/contract";
import { AppError } from "@/utils/errors";
import { UnitAuthorityService } from "./authority.service";

function actor(userId: string, role: "USER" | "ADMIN" | "ROOT" = "USER") {
  return { userId, permission: { role } } as RezicsSessionClaims;
}

function dbStub(input?: {
  unitUserId?: string | null;
  collaboratorRole?: string | null;
  withOutbox?: boolean;
}) {
  const db: Record<string, any> = {
    unit: {
      findUnique: mock(async () => ({
        id: "unit-1",
        userId: input?.unitUserId ?? "owner-1",
      })),
    },
    unitCollaborator: {
      findUnique: mock(async () =>
        input?.collaboratorRole ? { roleKey: input.collaboratorRole } : null,
      ),
      findMany: mock(async () => []),
      upsert: mock(async ({ create, update, where }: any) => ({
        unitId: create?.unitId ?? where.unitId_userId.unitId,
        userId: create?.userId ?? where.unitId_userId.userId,
        roleKey: update?.roleKey ?? create.roleKey,
        addedById: update?.addedById ?? create.addedById,
        createdAt: new Date("2026-05-19T00:00:00.000Z"),
      })),
      delete: mock(async () => ({})),
    },
    unitFieldLock: {
      findUnique: mock(async () => null),
      findMany: mock(async () => []),
      upsert: mock(async ({ create, update, where }: any) => ({
        unitId: create?.unitId ?? where.unitId_path.unitId,
        path: create?.path ?? where.unitId_path.path,
        lockedById: update?.lockedById ?? create.lockedById,
        reason: update?.reason ?? create.reason,
        createdAt: new Date("2026-05-19T00:00:00.000Z"),
      })),
      delete: mock(async () => ({})),
    },
  };
  if (input?.withOutbox) {
    db.$queryRaw = mock(async () => [{ sequence: 1n }]);
    db.historyOutbox = {
      create: mock(async () => ({})),
    };
    db.$transaction = mock(async (callback: (tx: typeof db) => unknown) =>
      callback(db),
    );
  }
  return db;
}

describe("UnitAuthorityService", () => {
  test("rejects collaborator mutation by ordinary community editor", async () => {
    const db = dbStub();
    const service = new UnitAuthorityService(db as never, async () => false);

    await expect(
      service.upsertCollaborator("unit-1", actor("user-2"), {
        userId: "user-3",
        roleKey: UnitAuthorityRoleKey.EDITOR,
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(db.unitCollaborator.upsert).not.toHaveBeenCalled();
  });

  test("allows primary owner to create a field lock", async () => {
    const db = dbStub();
    const service = new UnitAuthorityService(db as never, async () => false);

    const lock = await service.createFieldLock("unit-1", actor("owner-1"), {
      path: "*",
      reason: "protect imported metadata",
    });

    expect(lock).toMatchObject({
      unitId: "unit-1",
      path: "*",
      lockedById: "owner-1",
    });
    expect(db.unitFieldLock.upsert).toHaveBeenCalledTimes(1);
  });

  test("rejects field locks under externally governed paths", async () => {
    const db = dbStub();
    const service = new UnitAuthorityService(db as never, async () => false);

    await expect(
      service.createFieldLock("unit-1", actor("owner-1"), {
        path: "tags.genre",
        reason: "wrong surface",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "EXTERNALLY_GOVERNED_PATH",
      details: {
        offendingPath: "tags.genre",
        useApi: "/tags",
      },
    } satisfies Partial<AppError>);
    expect(db.unitFieldLock.upsert).not.toHaveBeenCalled();
  });

  test("allows admin override for collaborator mutation", async () => {
    const db = dbStub();
    const service = new UnitAuthorityService(db as never, async () => false);

    const collaborator = await service.upsertCollaborator(
      "unit-1",
      actor("admin-1", "ADMIN"),
      {
        userId: "user-3",
        roleKey: UnitAuthorityRoleKey.MAINTAINER,
      },
    );

    expect(collaborator).toMatchObject({
      unitId: "unit-1",
      userId: "user-3",
      roleKey: UnitAuthorityRoleKey.MAINTAINER,
      addedById: "admin-1",
    });
  });

  test("writes collaborator mutation outbox rows with canonical changes", async () => {
    const db = dbStub({ withOutbox: true });
    const service = new UnitAuthorityService(db as never, async () => false);

    await service.upsertCollaborator("unit-1", actor("owner-1"), {
      userId: "user-3",
      roleKey: UnitAuthorityRoleKey.EDITOR,
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.historyOutbox.create).toHaveBeenCalledTimes(1);
    expect(db.historyOutbox.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        unitId: "unit-1",
        sequence: 1n,
        actorUserId: "owner-1",
        category: "collaborator_mutation",
        payload: {
          kind: "collaborator_mutation",
          revision: {
            unitId: "unit-1",
            sequence: 1,
            actorUserId: "owner-1",
            message: "collaborator.upsert",
          },
        },
      },
    });
  });

  test("allows maintainer collaborator to manage locks", async () => {
    const db = dbStub({ collaboratorRole: UnitAuthorityRoleKey.MAINTAINER });
    const service = new UnitAuthorityService(db as never, async () => false);

    await service.deleteFieldLock("unit-1", actor("maintainer-1"), "*");

    expect(db.unitFieldLock.delete).toHaveBeenCalledTimes(1);
  });

  test("writes field lock mutation outbox rows with canonical changes", async () => {
    const db = dbStub({ withOutbox: true });
    const service = new UnitAuthorityService(db as never, async () => false);

    await service.createFieldLock("unit-1", actor("owner-1"), {
      path: "translations.en.title",
      reason: "verified title",
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.historyOutbox.create).toHaveBeenCalledTimes(1);
    expect(db.historyOutbox.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        unitId: "unit-1",
        sequence: 1n,
        actorUserId: "owner-1",
        category: "lock_mutation",
        payload: {
          kind: "lock_mutation",
          revision: {
            unitId: "unit-1",
            sequence: 1,
            actorUserId: "owner-1",
            message: "lock.upsert",
          },
        },
      },
    });
  });
});
