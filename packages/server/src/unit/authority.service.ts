import type {
  CreateUnitFieldLockInput,
  RezicsSessionClaims,
  UnitAuthorityRoleKey,
  UnitCollaboratorDTO,
  UnitFieldLockDTO,
  UpsertUnitCollaboratorInput,
} from "@rezics/contract";
import {
  HistoryOutboxPayloadKind,
  isExternallyGoverned,
} from "@rezics/contract";
import { and, asc, eq } from "drizzle-orm";
import { Unit, UnitCollaborator, UnitFieldLock } from "../db/schema";
import { AppError } from "../utils/errors";
import {
  type AuthorityUnit,
  type CollaborativeSurfacePolicy,
  canEditUnitFields,
} from "./authority";
import { createDrizzleCollaborativeMetadataTx } from "./collaborative-metadata";
import {
  buildEditorialRevisionPayload,
  type HistoryOutboxWriter,
  writeSequencedHistoryOutbox,
} from "./history-outbox";

type AuthorityUnitRow = {
  id: string;
  userId: string;
};

type AuthorityCollaboratorRow = {
  unitId: string;
  userId: string;
  roleKey: string;
  addedById: string;
  createdAt: Date;
};

type AuthorityFieldLockRow = {
  unitId: string;
  path: string;
  lockedById: string;
  reason: string | null;
  createdAt: Date;
};

type AuthorityDataDb = {
  unit: {
    findUnique(input: {
      where: { id: string };
      select: { id: true; userId: true };
    }): Promise<AuthorityUnitRow | null>;
  };
  unitCollaborator: {
    findUnique(input: {
      where: { unitId_userId: { unitId: string; userId: string } };
      select?: { roleKey?: true };
    }): Promise<AuthorityCollaboratorRow | null>;
    findMany(input: {
      where: { unitId: string };
      orderBy?: { createdAt: "asc" };
    }): Promise<AuthorityCollaboratorRow[]>;
    upsert(input: {
      where: { unitId_userId: { unitId: string; userId: string } };
      update: { roleKey: string; addedById: string };
      create: {
        unitId: string;
        userId: string;
        roleKey: string;
        addedById: string;
      };
    }): Promise<AuthorityCollaboratorRow>;
    delete(input: {
      where: { unitId_userId: { unitId: string; userId: string } };
    }): Promise<void>;
  };
  unitFieldLock: {
    findMany(input: {
      where: { unitId: string };
      select?: { path?: true };
      orderBy?: { createdAt: "asc" };
    }): Promise<AuthorityFieldLockRow[]>;
    upsert(input: {
      where: { unitId_path: { unitId: string; path: string } };
      update: { lockedById: string; reason: string | null };
      create: {
        unitId: string;
        path: string;
        lockedById: string;
        reason: string | null;
      };
    }): Promise<AuthorityFieldLockRow>;
    delete(input: {
      where: { unitId_path: { unitId: string; path: string } };
    }): Promise<void>;
  };
};

type AuthorityTransactionDb = AuthorityDataDb & HistoryOutboxWriter;

type AuthorityDb = AuthorityDataDb &
  Partial<HistoryOutboxWriter> & {
    $transaction?<T>(
      callback: (tx: AuthorityTransactionDb) => Promise<T>,
    ): Promise<T>;
  };

const MANAGE_AUTHORITY_POLICY: CollaborativeSurfacePolicy = {
  collaborative: false,
  collaboratorRoles: ["owner", "maintainer"] as UnitAuthorityRoleKey[],
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleAuthorityDb(database?: any) {
  async function db() {
    return database ?? (await getServerDb());
  }

  return {
    unit: {
      async findUnique(input: {
        where: { id: string };
        select: { id: true; userId: true };
      }) {
        const store = await db();
        const [unit] = await store
          .select({ id: Unit.id, userId: Unit.userId })
          .from(Unit)
          .where(eq(Unit.id, input.where.id))
          .limit(1);
        return unit ?? null;
      },
    },
    unitCollaborator: {
      async findUnique(input: {
        where: { unitId_userId: { unitId: string; userId: string } };
        select?: { roleKey?: true };
      }) {
        const store = await db();
        const [row] = await store
          .select()
          .from(UnitCollaborator)
          .where(
            and(
              eq(UnitCollaborator.unitId, input.where.unitId_userId.unitId),
              eq(UnitCollaborator.userId, input.where.unitId_userId.userId),
            ),
          )
          .limit(1);
        return row ?? null;
      },
      async findMany(input: { where: { unitId: string } }) {
        const store = await db();
        return store
          .select()
          .from(UnitCollaborator)
          .where(eq(UnitCollaborator.unitId, input.where.unitId))
          .orderBy(asc(UnitCollaborator.createdAt));
      },
      async upsert(input: {
        where: { unitId_userId: { unitId: string; userId: string } };
        update: { roleKey: string; addedById: string };
        create: {
          unitId: string;
          userId: string;
          roleKey: string;
          addedById: string;
        };
      }) {
        const store = await db();
        const [row] = await store
          .insert(UnitCollaborator)
          .values(input.create)
          .onConflictDoUpdate({
            target: [UnitCollaborator.unitId, UnitCollaborator.userId],
            set: input.update,
          })
          .returning();
        if (!row) throw new Error("Failed to upsert UnitCollaborator");
        return row;
      },
      async delete(input: {
        where: { unitId_userId: { unitId: string; userId: string } };
      }) {
        const store = await db();
        await store
          .delete(UnitCollaborator)
          .where(
            and(
              eq(UnitCollaborator.unitId, input.where.unitId_userId.unitId),
              eq(UnitCollaborator.userId, input.where.unitId_userId.userId),
            ),
          );
      },
    },
    unitFieldLock: {
      async findMany(input: {
        where: { unitId: string };
        select?: { path?: true };
      }) {
        const store = await db();
        return store
          .select()
          .from(UnitFieldLock)
          .where(eq(UnitFieldLock.unitId, input.where.unitId))
          .orderBy(asc(UnitFieldLock.createdAt));
      },
      async upsert(input: {
        where: { unitId_path: { unitId: string; path: string } };
        update: { lockedById: string; reason: string | null };
        create: {
          unitId: string;
          path: string;
          lockedById: string;
          reason: string | null;
        };
      }) {
        const store = await db();
        const [row] = await store
          .insert(UnitFieldLock)
          .values(input.create)
          .onConflictDoUpdate({
            target: [UnitFieldLock.unitId, UnitFieldLock.path],
            set: input.update,
          })
          .returning();
        if (!row) throw new Error("Failed to upsert UnitFieldLock");
        return row;
      },
      async delete(input: {
        where: { unitId_path: { unitId: string; path: string } };
      }) {
        const store = await db();
        await store
          .delete(UnitFieldLock)
          .where(
            and(
              eq(UnitFieldLock.unitId, input.where.unitId_path.unitId),
              eq(UnitFieldLock.path, input.where.unitId_path.path),
            ),
          );
      },
    },
    async $transaction<T>(
      callback: (tx: AuthorityTransactionDb) => Promise<T>,
    ): Promise<T> {
      const store = await getServerDb();
      return store.transaction((tx) =>
        callback(createDrizzleAuthorityDb(tx) as AuthorityTransactionDb),
      );
    },
    ...(database ? createDrizzleCollaborativeMetadataTx(database) : {}),
  };
}

const defaultDb = createDrizzleAuthorityDb() as AuthorityDb;

function toCollaboratorDTO(row: {
  unitId: string;
  userId: string;
  roleKey: string;
  addedById: string;
  createdAt: Date;
}): UnitCollaboratorDTO {
  return {
    unitId: row.unitId,
    userId: row.userId,
    roleKey: row.roleKey as UnitAuthorityRoleKey,
    addedById: row.addedById,
    createdAt: row.createdAt,
  };
}

function toLockDTO(row: {
  unitId: string;
  path: string;
  lockedById: string;
  reason: string | null;
  createdAt: Date;
}): UnitFieldLockDTO {
  return {
    unitId: row.unitId,
    path: row.path,
    lockedById: row.lockedById,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

export class UnitAuthorityService {
  constructor(
    private readonly db: AuthorityDb = defaultDb,
    private readonly verifyAdmin?: (userId: string) => Promise<boolean>,
  ) {}

  private async getAuthorityUnit(unitId: string): Promise<AuthorityUnit> {
    const unit = await this.db.unit.findUnique({
      where: { id: unitId },
      select: { id: true, userId: true },
    });
    if (!unit) {
      throw new AppError(404, "Unit not found", { code: "UNIT_NOT_FOUND" });
    }
    return unit;
  }

  async assertCanManageAuthority(
    caller: RezicsSessionClaims,
    unitId: string,
  ): Promise<void> {
    const unit = await this.getAuthorityUnit(unitId);
    const decision = await canEditUnitFields(
      caller,
      unit,
      [],
      MANAGE_AUTHORITY_POLICY,
      {
        lookup: {
          findCollaboratorRole: async (targetUnitId, targetUserId) => {
            const collaborator = await this.db.unitCollaborator.findUnique({
              where: {
                unitId_userId: {
                  unitId: targetUnitId,
                  userId: targetUserId,
                },
              },
              select: { roleKey: true },
            });
            return collaborator?.roleKey ?? null;
          },
          listFieldLockPaths: async (targetUnitId) => {
            const locks = await this.db.unitFieldLock.findMany({
              where: { unitId: targetUnitId },
              select: { path: true },
            });
            return locks.map((lock) => lock.path);
          },
        },
        verifyAdmin: this.verifyAdmin,
      },
    );

    if (!decision.allowed) {
      throw new AppError(403, "Forbidden: cannot manage Unit authority", {
        code: decision.code,
        details: {
          unitId,
          blockedPaths: decision.blockedPaths,
          offendingLockPath: decision.offendingLockPath,
          offendingPatchPath: decision.offendingPatchPath,
          collaboratorRole: decision.collaboratorRole,
        },
      });
    }
  }

  async listCollaborators(unitId: string): Promise<UnitCollaboratorDTO[]> {
    const rows = await this.db.unitCollaborator.findMany({
      where: { unitId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toCollaboratorDTO);
  }

  async upsertCollaborator(
    unitId: string,
    actor: RezicsSessionClaims,
    input: UpsertUnitCollaboratorInput,
  ): Promise<UnitCollaboratorDTO> {
    await this.assertCanManageAuthority(actor, unitId);
    return this.runAuthorityMutation(unitId, async (tx) => {
      const row = await tx.unitCollaborator.upsert({
        where: { unitId_userId: { unitId, userId: input.userId } },
        update: { roleKey: input.roleKey, addedById: actor.userId },
        create: {
          unitId,
          userId: input.userId,
          roleKey: input.roleKey,
          addedById: actor.userId,
        },
      });
      const collaborator = toCollaboratorDTO(row);
      await this.writeAuthorityAudit(tx, {
        unitId,
        actorUserId: actor.userId,
        kind: HistoryOutboxPayloadKind.COLLABORATOR_MUTATION,
        operation: "collaborator.upsert",
        payload: { collaborator },
      });
      return collaborator;
    });
  }

  async removeCollaborator(
    unitId: string,
    actor: RezicsSessionClaims,
    userId: string,
  ): Promise<void> {
    await this.assertCanManageAuthority(actor, unitId);
    await this.runAuthorityMutation(unitId, async (tx) => {
      await tx.unitCollaborator.delete({
        where: { unitId_userId: { unitId, userId } },
      });
      await this.writeAuthorityAudit(tx, {
        unitId,
        actorUserId: actor.userId,
        kind: HistoryOutboxPayloadKind.COLLABORATOR_MUTATION,
        operation: "collaborator.remove",
        payload: { collaborator: { unitId, userId } },
      });
    });
  }

  async listFieldLocks(unitId: string): Promise<UnitFieldLockDTO[]> {
    const rows = await this.db.unitFieldLock.findMany({
      where: { unitId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toLockDTO);
  }

  async createFieldLock(
    unitId: string,
    actor: RezicsSessionClaims,
    input: CreateUnitFieldLockInput,
  ): Promise<UnitFieldLockDTO> {
    await this.assertCanManageAuthority(actor, unitId);
    if (isExternallyGoverned(input.path)) {
      throw new AppError(400, "Path is externally governed", {
        code: "EXTERNALLY_GOVERNED_PATH",
        details: {
          offendingPath: input.path,
          useApi: input.path.startsWith("realmTagApplications")
            ? "/realm-tag-application"
            : "/tags",
        },
      });
    }
    return this.runAuthorityMutation(unitId, async (tx) => {
      const row = await tx.unitFieldLock.upsert({
        where: { unitId_path: { unitId, path: input.path } },
        update: {
          lockedById: actor.userId,
          reason: input.reason ?? null,
        },
        create: {
          unitId,
          path: input.path,
          lockedById: actor.userId,
          reason: input.reason ?? null,
        },
      });
      const lock = toLockDTO(row);
      await this.writeAuthorityAudit(tx, {
        unitId,
        actorUserId: actor.userId,
        kind: HistoryOutboxPayloadKind.LOCK_MUTATION,
        operation: "lock.upsert",
        payload: { lock },
      });
      return lock;
    });
  }

  async deleteFieldLock(
    unitId: string,
    actor: RezicsSessionClaims,
    path: string,
  ): Promise<void> {
    await this.assertCanManageAuthority(actor, unitId);
    await this.runAuthorityMutation(unitId, async (tx) => {
      await tx.unitFieldLock.delete({
        where: { unitId_path: { unitId, path } },
      });
      await this.writeAuthorityAudit(tx, {
        unitId,
        actorUserId: actor.userId,
        kind: HistoryOutboxPayloadKind.LOCK_MUTATION,
        operation: "lock.delete",
        payload: { lock: { unitId, path } },
      });
    });
  }

  private async runAuthorityMutation<T>(
    unitId: string,
    callback: (tx: AuthorityTransactionDb) => Promise<T>,
  ): Promise<T> {
    if (this.db.$transaction) {
      return this.db.$transaction(callback);
    }
    return callback(this.db as AuthorityTransactionDb);
  }

  private async writeAuthorityAudit(
    tx: AuthorityTransactionDb,
    input: {
      unitId: string;
      actorUserId: string;
      kind:
        | typeof HistoryOutboxPayloadKind.LOCK_MUTATION
        | typeof HistoryOutboxPayloadKind.COLLABORATOR_MUTATION;
      operation: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    if (!tx.historyOutbox || !tx.$queryRaw) return;

    await writeSequencedHistoryOutbox(tx, {
      unitId: input.unitId,
      actorUserId: input.actorUserId,
      buildPayload: (sequence) => ({
        kind: input.kind,
        revision: buildEditorialRevisionPayload({
          unitId: input.unitId,
          sequence,
          actorUserId: input.actorUserId,
          patch: {
            unit: {
              authority: {
                operation: input.operation,
                ...input.payload,
              },
            },
          },
          message: input.operation,
        }),
      }),
    });
  }
}

export const unitAuthorityService = new UnitAuthorityService();
