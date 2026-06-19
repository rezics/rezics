import type {
  PinboardAdminReadResponse,
  PinboardOkResponse,
  PinboardReadResponse,
  RezicsSessionClaims,
} from "@rezics/contract";
import { and, asc, eq, inArray, ne, or } from "drizzle-orm";
import { governanceAuditService, realmPolicyActions } from "@/governance";
import { Realm, Pinboard, PinboardEntry, Unit } from "../db/schema";
import { generateBetween, rebalance } from "../shelf/fractional-index";
import {
  mapPinboardAdminReadResponse,
  mapPinboardReadResponse,
} from "./pinboard.mapper";

export class PinboardError extends Error {
  constructor(
    public code:
      | "REALM_NOT_FOUND"
      | "PINBOARD_NOT_FOUND"
      | "INVALID_PLACEMENT"
      | "INVALID_REORDER",
    message: string,
    public httpStatus: 400 | 404,
  ) {
    super(message);
    this.name = "PinboardError";
  }
}

function callerUserId(caller?: RezicsSessionClaims | null): string | undefined {
  return (caller as { userId?: string; unitId?: string } | null | undefined)
    ?.userId;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function assertRealmPinboardPlacement(placement: string) {
  if (placement !== "home") {
    throw new PinboardError(
      "INVALID_PLACEMENT",
      "Pinboard placement must be home",
      400,
    );
  }
}

async function visibleUnitIdSet(
  ids: string[],
  caller?: RezicsSessionClaims | null,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const db = await getServerDb();
  const visibilityClauses = [eq(Unit.visibility, "PUBLIC")];
  const userId = callerUserId(caller);
  if (userId) visibilityClauses.push(eq(Unit.userId, userId));
  const rows = await db
    .select({ id: Unit.id })
    .from(Unit)
    .where(
      and(
        inArray(Unit.id, ids),
        ne(Unit.status, "DELETED"),
        or(...visibilityClauses),
      ),
    );
  return new Set(rows.map((unit) => unit.id));
}

async function liveUnitIdSet(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const db = await getServerDb();
  const rows = await db
    .select({ id: Unit.id })
    .from(Unit)
    .where(and(inArray(Unit.id, ids), ne(Unit.status, "DELETED")));
  return new Set(rows.map((unit) => unit.id));
}

export class PinboardService {
  async ensure(realmUnitId: string, placement = "home") {
    assertRealmPinboardPlacement(placement);
    const db = await getServerDb();
    const [realm] = await db
      .select({ unitId: Realm.unitId })
      .from(Realm)
      .where(eq(Realm.unitId, realmUnitId))
      .limit(1);
    if (!realm) {
      throw new PinboardError("REALM_NOT_FOUND", "Realm not found", 404);
    }

    const [existing] = await db
      .select()
      .from(Pinboard)
      .where(
        and(
          eq(Pinboard.realmUnitId, realmUnitId),
          eq(Pinboard.placement, placement),
        ),
      )
      .limit(1);
    if (existing) return existing;

    const [created] = await db
      .insert(Pinboard)
      .values({ realmUnitId, placement, kind: "list" })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const [afterConflict] = await db
      .select()
      .from(Pinboard)
      .where(
        and(
          eq(Pinboard.realmUnitId, realmUnitId),
          eq(Pinboard.placement, placement),
        ),
      )
      .limit(1);
    if (!afterConflict) {
      throw new PinboardError(
        "PINBOARD_NOT_FOUND",
        "Pinboard could not be created",
        404,
      );
    }
    return afterConflict;
  }

  async readPublic(
    caller: RezicsSessionClaims | null,
    realmUnitId: string,
    placement = "home",
  ): Promise<PinboardReadResponse> {
    const pinboard = await this.ensure(realmUnitId, placement);
    const entries = await this.entries(pinboard.id);
    const visible = await visibleUnitIdSet(
      entries.map((entry) => entry.unitId),
      caller,
    );
    return mapPinboardReadResponse({
      pinboard,
      entries: entries.filter((entry) => visible.has(entry.unitId)),
    });
  }

  async readAdmin(
    realmUnitId: string,
    placement = "home",
  ): Promise<PinboardAdminReadResponse> {
    const pinboard = await this.ensure(realmUnitId, placement);
    const entries = await this.entries(pinboard.id);
    const live = await liveUnitIdSet(entries.map((entry) => entry.unitId));
    return mapPinboardAdminReadResponse({
      pinboard,
      entries,
      staleIds: entries
        .map((entry) => entry.unitId)
        .filter((unitId) => !live.has(unitId)),
    });
  }

  async append(input: {
    caller: RezicsSessionClaims;
    realmUnitId: string;
    placement?: string;
    unitId: string;
  }): Promise<PinboardOkResponse> {
    const pinboard = await this.ensure(
      input.realmUnitId,
      input.placement ?? "home",
    );
    const db = await getServerDb();
    const entries = await this.entries(pinboard.id);
    const existing = entries.find((entry) => entry.unitId === input.unitId);
    if (!existing) {
      const last = entries.at(-1);
      await db.insert(PinboardEntry).values({
        pinboardId: pinboard.id,
        unitId: input.unitId,
        position: generateBetween(last?.position, undefined),
      });
    }
    const nextEntries = await this.entries(pinboard.id);
    await this.audit(input.caller, pinboard, "append", {
      unitId: input.unitId,
      unitIds: nextEntries.map((entry) => entry.unitId),
    });
    return { ok: true, unitIds: nextEntries.map((entry) => entry.unitId) };
  }

  async remove(input: {
    caller: RezicsSessionClaims;
    realmUnitId: string;
    placement?: string;
    unitId: string;
  }): Promise<PinboardOkResponse> {
    const pinboard = await this.ensure(
      input.realmUnitId,
      input.placement ?? "home",
    );
    const db = await getServerDb();
    await db
      .delete(PinboardEntry)
      .where(
        and(
          eq(PinboardEntry.pinboardId, pinboard.id),
          eq(PinboardEntry.unitId, input.unitId),
        ),
      );
    const entries = await this.entries(pinboard.id);
    await this.audit(input.caller, pinboard, "remove", {
      unitId: input.unitId,
      unitIds: entries.map((entry) => entry.unitId),
    });
    return { ok: true, unitIds: entries.map((entry) => entry.unitId) };
  }

  async reorder(input: {
    caller: RezicsSessionClaims;
    realmUnitId: string;
    placement?: string;
    unitIds: string[];
  }): Promise<PinboardOkResponse> {
    const pinboard = await this.ensure(
      input.realmUnitId,
      input.placement ?? "home",
    );
    const entries = await this.entries(pinboard.id);
    const current = entries.map((entry) => entry.unitId);
    const currentSet = new Set(current);
    const incomingSet = new Set(input.unitIds);
    if (
      currentSet.size !== incomingSet.size ||
      currentSet.size !== input.unitIds.length ||
      [...currentSet].some((id) => !incomingSet.has(id))
    ) {
      throw new PinboardError(
        "INVALID_REORDER",
        "Reorder must be a permutation of the existing list",
        400,
      );
    }

    const db = await getServerDb();
    const positions = rebalance(input.unitIds.length);
    await db.transaction(async (tx) => {
      for (const [index, unitId] of input.unitIds.entries()) {
        await tx
          .update(PinboardEntry)
          .set({ position: positions[index]!, updatedAt: new Date() })
          .where(
            and(
              eq(PinboardEntry.pinboardId, pinboard.id),
              eq(PinboardEntry.unitId, unitId),
            ),
          );
      }
    });
    await this.audit(input.caller, pinboard, "reorder", {
      unitIds: input.unitIds,
    });
    return { ok: true, unitIds: input.unitIds };
  }

  private async entries(pinboardId: string) {
    const db = await getServerDb();
    return db
      .select()
      .from(PinboardEntry)
      .where(eq(PinboardEntry.pinboardId, pinboardId))
      .orderBy(asc(PinboardEntry.position), asc(PinboardEntry.unitId));
  }

  private audit(
    caller: RezicsSessionClaims,
    pinboard: typeof Pinboard.$inferSelect,
    operation: "append" | "reorder" | "remove",
    metadata: Record<string, unknown>,
  ) {
    return governanceAuditService.appendPrivilegedMutation({
      actorUserId: caller.userId,
      action: realmPolicyActions.contentPin,
      targetKind: "pinboard",
      targetId: pinboard.id,
      reason: `Pinboard ${pinboard.placement} ${operation}`,
      correlationId: crypto.randomUUID(),
      metadata: {
        realmUnitId: pinboard.realmUnitId,
        placement: pinboard.placement,
        operation,
        ...metadata,
      },
    });
  }
}

export const pinboardService = new PinboardService();
