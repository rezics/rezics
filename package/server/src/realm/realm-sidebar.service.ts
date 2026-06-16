import type {
  RealmSidebar,
  RealmSidebarWidget,
  RezicsSessionClaims,
} from "@rezics/contract";
import { emptyRealmSidebar, parseRealmSidebar } from "@rezics/contract";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { hasAuthorityOver } from "@/unit/authority";
import { Realm, RealmMember, Unit } from "../db/schema";

export class RealmSidebarError extends Error {
  constructor(
    public code:
      | "REALM_NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_SIDEBAR"
      | "INVALID_REFERENCE",
    message: string,
    public httpStatus: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "RealmSidebarError";
  }
}

const REALM_AUTHORITY_ROLES = ["owner", "admin", "moderator"] as const;
const CONTENT_WIDGET_UNIT_TYPES = new Set(["POST"]);

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
    throw new RealmSidebarError("REALM_NOT_FOUND", "Realm not found", 404);
  }

  if (await hasAuthorityOver(caller, { id: realm.id, userId: realm.userId })) {
    return;
  }

  const userId = callerUserId(caller);
  if (!userId) {
    throw new RealmSidebarError(
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
    throw new RealmSidebarError(
      "FORBIDDEN",
      "Caller lacks moderator authority over this realm",
      403,
    );
  }
}

function addId(target: Map<string, Set<string>>, type: string, id?: string) {
  if (!id) return;
  const current = target.get(type) ?? new Set<string>();
  current.add(id);
  target.set(type, current);
}

function collectWidgetReferences(
  sidebar: RealmSidebar,
): Map<string, Set<string>> {
  const refs = new Map<string, Set<string>>();

  const visit = (widget: RealmSidebarWidget) => {
    addId(refs, "LABEL", widget.titleLabelUnitId);
    switch (widget.kind) {
      case "text":
        addId(refs, "POST", widget.contentUnitId);
        break;
      case "buttons":
        for (const item of widget.items) addId(refs, "LABEL", item.labelUnitId);
        break;
      case "images":
        for (const item of widget.items)
          addId(refs, "LABEL", item.altLabelUnitId);
        break;
      case "communityList":
        for (const realmUnitId of widget.realmUnitIds) {
          addId(refs, "REALM", realmUnitId);
        }
        break;
      case "featuredZone":
      case "zoneNav":
        addId(refs, "ZONE", widget.zoneUnitId);
        break;
      case "pinboard":
        break;
      case "calendar":
      case "rules":
      case "stats":
        break;
    }
  };

  for (const widgets of Object.values(sidebar.placements)) {
    widgets?.forEach(visit);
  }

  return refs;
}

async function validateReferences(sidebar: RealmSidebar): Promise<void> {
  const refs = collectWidgetReferences(sidebar);
  const db = await getServerDb();
  for (const [type, ids] of refs) {
    if (ids.size === 0) continue;
    const rows = await db
      .select({ id: Unit.id, type: Unit.type })
      .from(Unit)
      .where(and(inArray(Unit.id, [...ids]), ne(Unit.status, "DELETED")));
    const valid = new Set(
      rows
        .filter((row) =>
          type === "POST"
            ? CONTENT_WIDGET_UNIT_TYPES.has(row.type)
            : row.type === type,
        )
        .map((row) => row.id),
    );
    const missing = [...ids].filter((id) => !valid.has(id));
    if (missing.length > 0) {
      throw new RealmSidebarError(
        "INVALID_REFERENCE",
        `Invalid ${type} sidebar references: ${missing.join(", ")}`,
        400,
      );
    }
  }
}

export class RealmSidebarService {
  async read(realmId: string): Promise<RealmSidebar> {
    const db = await getServerDb();
    const [realm] = await db
      .select({ sidebar: Realm.sidebar })
      .from(Realm)
      .where(eq(Realm.unitId, realmId))
      .limit(1);
    if (!realm) {
      throw new RealmSidebarError("REALM_NOT_FOUND", "Realm not found", 404);
    }
    return parseRealmSidebar(realm.sidebar) ?? emptyRealmSidebar();
  }

  async update(input: {
    caller: RezicsSessionClaims;
    realmId: string;
    sidebar: unknown;
  }): Promise<RealmSidebar> {
    const sidebar = parseRealmSidebar(input.sidebar);
    if (!sidebar) {
      throw new RealmSidebarError(
        "INVALID_SIDEBAR",
        "Invalid realm sidebar envelope",
        400,
      );
    }
    await authorizeForRealm(input.caller, input.realmId);
    await validateReferences(sidebar);

    const db = await getServerDb();
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT 1 FROM "Realm" WHERE "unitId" = ${input.realmId}::uuid FOR UPDATE`,
      );
      await tx
        .update(Realm)
        .set({ sidebar, updatedAt: new Date() })
        .where(eq(Realm.unitId, input.realmId));
    });
    return sidebar;
  }
}

export const realmSidebarService = new RealmSidebarService();
