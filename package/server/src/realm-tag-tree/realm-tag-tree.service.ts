import type {
  RealmTagTree,
  RealmTagTreeNode,
  RezicsSessionClaims,
} from "@rezics/contract";
import { realmTagTreeEnvelopeSchema } from "@rezics/contract";
import { Value } from "@sinclair/typebox/value";
import { and, eq, inArray, sql } from "drizzle-orm";
import { hasAuthorityOver } from "@/unit/authority";
import {
  Realm,
  RealmMember,
  RealmTagTree as RealmTagTreeTable,
  Unit,
} from "../db/schema";
import { mapRealmTagTreeToDTO } from "./realm-tag-tree.mapper";

const REALM_AUTHORITY_ROLES = ["owner", "admin", "moderator"] as const;
const MAX_TAG_TREE_NODES = 1000;
const MAX_TAG_TREE_DEPTH = 8;

export class RealmTagTreeError extends Error {
  constructor(
    public code:
      | "REALM_NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_TREE"
      | "TAG_NOT_FOUND"
      | "LABEL_NOT_FOUND",
    message: string,
    public httpStatus: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "RealmTagTreeError";
  }
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function callerUserId(caller?: RezicsSessionClaims | null): string | undefined {
  return (caller as { userId?: string; unitId?: string } | null | undefined)
    ?.userId;
}

function collectRefs(tree: RealmTagTree) {
  const tagUnitIds = new Set<string>();
  const labelUnitIds = new Set<string>();
  let nodeCount = 0;

  function visit(nodes: readonly RealmTagTreeNode[], depth: number) {
    if (depth > MAX_TAG_TREE_DEPTH) {
      throw new RealmTagTreeError(
        "INVALID_TREE",
        `Realm tag tree depth must not exceed ${MAX_TAG_TREE_DEPTH}`,
        400,
      );
    }
    for (const node of nodes) {
      nodeCount += 1;
      if (nodeCount > MAX_TAG_TREE_NODES) {
        throw new RealmTagTreeError(
          "INVALID_TREE",
          `Realm tag tree must not exceed ${MAX_TAG_TREE_NODES} nodes`,
          400,
        );
      }
      if (node.kind === "tag") {
        tagUnitIds.add(node.tagUnitId);
        if (node.labelUnitId) labelUnitIds.add(node.labelUnitId);
      } else {
        labelUnitIds.add(node.labelUnitId);
      }
      if (node.children?.length) visit(node.children, depth + 1);
    }
  }

  visit(tree.nodes, 1);
  return { tagUnitIds, labelUnitIds };
}

export class RealmTagTreeService {
  async get(realmUnitId: string) {
    const db = await getServerDb();
    const [realm] = await db
      .select({ unitId: Realm.unitId })
      .from(Realm)
      .where(eq(Realm.unitId, realmUnitId))
      .limit(1);
    if (!realm) {
      throw new RealmTagTreeError("REALM_NOT_FOUND", "Realm not found", 404);
    }
    const [row] = await db
      .select()
      .from(RealmTagTreeTable)
      .where(eq(RealmTagTreeTable.realmUnitId, realmUnitId))
      .limit(1);
    return mapRealmTagTreeToDTO(realmUnitId, row ?? null);
  }

  async update(
    caller: RezicsSessionClaims,
    realmUnitId: string,
    tree: RealmTagTree,
  ) {
    await this.authorize(caller, realmUnitId);
    await this.validateTree(tree);
    const db = await getServerDb();
    const [row] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT 1 FROM "Realm" WHERE "unitId" = ${realmUnitId}::uuid FOR UPDATE`,
      );
      return tx
        .insert(RealmTagTreeTable)
        .values({ realmUnitId, tree, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: RealmTagTreeTable.realmUnitId,
          set: { tree, updatedAt: new Date() },
        })
        .returning();
    });
    return mapRealmTagTreeToDTO(realmUnitId, row ?? null);
  }

  private async authorize(caller: RezicsSessionClaims, realmUnitId: string) {
    const db = await getServerDb();
    const [realm] = await db
      .select({ id: Unit.id, userId: Unit.userId, type: Unit.type })
      .from(Unit)
      .where(eq(Unit.id, realmUnitId))
      .limit(1);
    if (!realm || realm.type !== "REALM") {
      throw new RealmTagTreeError("REALM_NOT_FOUND", "Realm not found", 404);
    }
    if (
      await hasAuthorityOver(caller, { id: realm.id, userId: realm.userId })
    ) {
      return;
    }
    const userId = callerUserId(caller);
    if (!userId) {
      throw new RealmTagTreeError(
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
          eq(RealmMember.realmUnitId, realmUnitId),
          eq(RealmMember.userId, userId),
          inArray(RealmMember.roleKey, [...REALM_AUTHORITY_ROLES]),
        ),
      )
      .limit(1);
    if (!member) {
      throw new RealmTagTreeError(
        "FORBIDDEN",
        "Caller lacks moderator authority over this realm",
        403,
      );
    }
  }

  private async validateTree(tree: RealmTagTree) {
    if (!Value.Check(realmTagTreeEnvelopeSchema, tree)) {
      throw new RealmTagTreeError(
        "INVALID_TREE",
        "Realm tag tree envelope is invalid",
        400,
      );
    }
    const { tagUnitIds, labelUnitIds } = collectRefs(tree);
    const db = await getServerDb();
    if (tagUnitIds.size > 0) {
      const rows = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(and(inArray(Unit.id, [...tagUnitIds]), eq(Unit.type, "TAG")));
      const found = new Set(rows.map((row) => row.id));
      const missing = [...tagUnitIds].filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new RealmTagTreeError(
          "TAG_NOT_FOUND",
          `Invalid tagUnitId values: ${missing.join(", ")}`,
          400,
        );
      }
    }
    if (labelUnitIds.size > 0) {
      const rows = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(
          and(inArray(Unit.id, [...labelUnitIds]), eq(Unit.type, "LABEL")),
        );
      const found = new Set(rows.map((row) => row.id));
      const missing = [...labelUnitIds].filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new RealmTagTreeError(
          "LABEL_NOT_FOUND",
          `Invalid labelUnitId values: ${missing.join(", ")}`,
          400,
        );
      }
    }
  }
}

export const realmTagTreeService = new RealmTagTreeService();
