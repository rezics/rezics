import type { RealmDock, RezicsSessionClaims } from "@rezics/contract";
import { emptyRealmDock, parseRealmDock } from "@rezics/contract";
import { and, eq, inArray, sql } from "drizzle-orm";
import { hasAuthorityOver } from "@/unit/authority";
import { Realm, RealmMember, Unit } from "../db/schema";

export class RealmDockError extends Error {
  constructor(
    public code: "REALM_NOT_FOUND" | "FORBIDDEN" | "INVALID_DOCK",
    message: string,
    public httpStatus: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "RealmDockError";
  }
}

const REALM_AUTHORITY_ROLES = ["owner", "admin", "moderator"] as const;

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function callerUserId(caller?: RezicsSessionClaims | null): string | undefined {
  return (caller as { userId?: string; unitId?: string } | null | undefined)
    ?.userId;
}

async function authorizeForRealm(
  caller: RezicsSessionClaims,
  realmId: string,
): Promise<void> {
  const db = await getServerDb();
  const [realm] = await db
    .select({ id: Unit.id, userId: Unit.userId, type: Unit.type })
    .from(Unit)
    .where(eq(Unit.id, realmId))
    .limit(1);
  if (!realm || realm.type !== "REALM") {
    throw new RealmDockError("REALM_NOT_FOUND", "Realm not found", 404);
  }

  if (await hasAuthorityOver(caller, { id: realm.id, userId: realm.userId })) {
    return;
  }

  const userId = callerUserId(caller);
  if (!userId) {
    throw new RealmDockError(
      "FORBIDDEN",
      "Caller lacks moderator authority over this realm",
      403,
    );
  }

  const [member] = await db
    .select({ realmUnitId: RealmMember.realmUnitId })
    .from(RealmMember)
    .where(
      and(
        eq(RealmMember.realmUnitId, realmId),
        eq(RealmMember.userId, userId),
        inArray(RealmMember.roleKey, [...REALM_AUTHORITY_ROLES]),
      ),
    )
    .limit(1);
  if (!member) {
    throw new RealmDockError(
      "FORBIDDEN",
      "Caller lacks moderator authority over this realm",
      403,
    );
  }
}

export class RealmDockService {
  async read(realmId: string): Promise<RealmDock> {
    const db = await getServerDb();
    const [realm] = await db
      .select({ dock: Realm.dock })
      .from(Realm)
      .where(eq(Realm.unitId, realmId))
      .limit(1);
    if (!realm) {
      throw new RealmDockError("REALM_NOT_FOUND", "Realm not found", 404);
    }
    return parseRealmDock(realm.dock) ?? emptyRealmDock();
  }

  async update(input: {
    caller: RezicsSessionClaims;
    realmId: string;
    dock: unknown;
  }): Promise<RealmDock> {
    const dock = parseRealmDock(input.dock);
    if (!dock) {
      throw new RealmDockError(
        "INVALID_DOCK",
        "Invalid realm Dock envelope",
        400,
      );
    }
    await authorizeForRealm(input.caller, input.realmId);
    // Target references are weak frontend-owned links. The server validates
    // Dock shape and authority only so stale Unit/Zone/Post targets can be
    // shown and repaired in the editor instead of blocking unrelated saves.

    const db = await getServerDb();
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT 1 FROM "Realm" WHERE "unitId" = ${input.realmId}::uuid FOR UPDATE`,
      );
      await tx
        .update(Realm)
        .set({ dock, updatedAt: new Date() })
        .where(eq(Realm.unitId, input.realmId));
    });
    return dock;
  }
}

export const realmDockService = new RealmDockService();
