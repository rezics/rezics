import type {
  CreatePolicyTagApplicationInput,
  CreatePolicyTagRuleInput,
  PatchPolicyTagApplicationInput,
  PolicyTagApplicationListQuery,
  PolicyTagRuleListQuery,
  UpdatePolicyTagRuleInput,
} from "@rezics/contract";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { PolicyTagApplication, PolicyTagRule, Unit } from "../db/schema";

type PolicyTagRuleRow = typeof PolicyTagRule.$inferSelect;

export class PolicyTagError extends Error {
  constructor(
    public code:
      | "INVALID_SCOPE"
      | "TAG_NOT_FOUND"
      | "RULE_NOT_FOUND"
      | "RULE_ARCHIVED"
      | "APPLICATION_NOT_FOUND",
    message: string,
    public httpStatus: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "PolicyTagError";
  }
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function storageRuleState(state?: "active" | "archived") {
  return state === "archived" ? "ARCHIVED" : "ACTIVE";
}

function assertScope(input: CreatePolicyTagRuleInput["scope"]) {
  if (input.kind === "realm" && !input.realmUnitId) {
    throw new PolicyTagError(
      "INVALID_SCOPE",
      "Realm policy-tag scope requires realmUnitId",
      400,
    );
  }
}

function ruleFilters(query: PolicyTagRuleListQuery) {
  const filters = [];
  if (query.scopeKind)
    filters.push(eq(PolicyTagRule.scopeKind, query.scopeKind));
  if (query.realmUnitId) {
    filters.push(eq(PolicyTagRule.realmUnitId, query.realmUnitId));
  }
  if (query.tagUnitId)
    filters.push(eq(PolicyTagRule.tagUnitId, query.tagUnitId));
  if (query.state)
    filters.push(eq(PolicyTagRule.state, storageRuleState(query.state)));
  return filters;
}

function applicationFilters(query: PolicyTagApplicationListQuery) {
  const filters = [];
  if (query.ruleId) filters.push(eq(PolicyTagApplication.ruleId, query.ruleId));
  if (query.unitId) filters.push(eq(PolicyTagApplication.unitId, query.unitId));
  if (query.scopeKind)
    filters.push(eq(PolicyTagRule.scopeKind, query.scopeKind));
  if (query.realmUnitId) {
    filters.push(eq(PolicyTagRule.realmUnitId, query.realmUnitId));
  }
  if (query.tagUnitId)
    filters.push(eq(PolicyTagRule.tagUnitId, query.tagUnitId));
  return filters;
}

export class PolicyTagService {
  async createRule(actorUserId: string, input: CreatePolicyTagRuleInput) {
    assertScope(input.scope);
    await this.assertTagUnit(input.tagUnitId);
    const db = await getServerDb();
    const [row] = await db
      .insert(PolicyTagRule)
      .values({
        scopeKind: input.scope.kind,
        realmUnitId:
          input.scope.kind === "realm" ? input.scope.realmUnitId : null,
        tagUnitId: input.tagUnitId,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
        reason: input.reason ?? null,
        updatedAt: new Date(),
      })
      .returning();
    if (!row) {
      throw new PolicyTagError(
        "RULE_NOT_FOUND",
        "Policy tag rule could not be created",
        404,
      );
    }
    return row;
  }

  async listRules(query: PolicyTagRuleListQuery) {
    const db = await getServerDb();
    const limit = Math.max(1, Math.min(Number(query.limit ?? 50), 100));
    const offset = Math.max(0, Number(query.offset ?? 0));
    const filters = ruleFilters(query);
    const where = filters.length > 0 ? and(...filters) : undefined;
    const rows = await db
      .select()
      .from(PolicyTagRule)
      .where(where)
      .orderBy(
        asc(PolicyTagRule.scopeKind),
        asc(PolicyTagRule.realmUnitId),
        asc(PolicyTagRule.tagUnitId),
        asc(PolicyTagRule.createdAt),
      )
      .limit(limit)
      .offset(offset);
    const [totalRow] = await db
      .select({ total: count() })
      .from(PolicyTagRule)
      .where(where);
    return { rows, total: totalRow?.total ?? 0 };
  }

  async getRule(ruleId: string) {
    const db = await getServerDb();
    const [row] = await db
      .select()
      .from(PolicyTagRule)
      .where(eq(PolicyTagRule.id, ruleId))
      .limit(1);
    if (!row) {
      throw new PolicyTagError(
        "RULE_NOT_FOUND",
        "Policy tag rule not found",
        404,
      );
    }
    return row;
  }

  async updateRule(
    actorUserId: string,
    ruleId: string,
    input: UpdatePolicyTagRuleInput,
  ) {
    const [row] = await (await getServerDb())
      .update(PolicyTagRule)
      .set({
        ...(input.state ? { state: storageRuleState(input.state) } : {}),
        ...(Object.hasOwn(input, "reason")
          ? { reason: input.reason ?? null }
          : {}),
        updatedByUserId: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(PolicyTagRule.id, ruleId))
      .returning();
    if (!row) {
      throw new PolicyTagError(
        "RULE_NOT_FOUND",
        "Policy tag rule not found",
        404,
      );
    }
    return row;
  }

  async upsertApplication(
    actorUserId: string,
    ruleId: string,
    input: CreatePolicyTagApplicationInput,
  ) {
    await this.assertActiveRule(ruleId);
    const db = await getServerDb();
    const [row] = await db
      .insert(PolicyTagApplication)
      .values({
        ruleId,
        unitId: input.unitId,
        position: input.position ?? null,
        metadata: input.metadata ?? null,
        appliedByUserId: actorUserId,
        updatedByUserId: actorUserId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [PolicyTagApplication.ruleId, PolicyTagApplication.unitId],
        set: {
          position: input.position ?? null,
          metadata: input.metadata ?? null,
          updatedByUserId: actorUserId,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) {
      throw new PolicyTagError(
        "APPLICATION_NOT_FOUND",
        "Policy tag application could not be saved",
        404,
      );
    }
    return this.getApplicationWithRule(row.ruleId, row.unitId);
  }

  async patchApplication(
    actorUserId: string,
    ruleId: string,
    unitId: string,
    input: PatchPolicyTagApplicationInput,
  ) {
    await this.assertActiveRule(ruleId);
    const [row] = await (await getServerDb())
      .update(PolicyTagApplication)
      .set({
        ...(Object.hasOwn(input, "position")
          ? { position: input.position ?? null }
          : {}),
        ...(Object.hasOwn(input, "metadata")
          ? { metadata: input.metadata ?? null }
          : {}),
        updatedByUserId: actorUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(PolicyTagApplication.ruleId, ruleId),
          eq(PolicyTagApplication.unitId, unitId),
        ),
      )
      .returning();
    if (!row) {
      throw new PolicyTagError(
        "APPLICATION_NOT_FOUND",
        "Policy tag application not found",
        404,
      );
    }
    return this.getApplicationWithRule(row.ruleId, row.unitId);
  }

  async deleteApplication(ruleId: string, unitId: string) {
    const [row] = await (await getServerDb())
      .delete(PolicyTagApplication)
      .where(
        and(
          eq(PolicyTagApplication.ruleId, ruleId),
          eq(PolicyTagApplication.unitId, unitId),
        ),
      )
      .returning();
    if (!row) {
      throw new PolicyTagError(
        "APPLICATION_NOT_FOUND",
        "Policy tag application not found",
        404,
      );
    }
  }

  async listApplications(query: PolicyTagApplicationListQuery) {
    const db = await getServerDb();
    const limit = Math.max(1, Math.min(Number(query.limit ?? 50), 100));
    const offset = Math.max(0, Number(query.offset ?? 0));
    const filters = applicationFilters(query);
    const where = filters.length > 0 ? and(...filters) : undefined;
    const rows = await db
      .select({ application: PolicyTagApplication, rule: PolicyTagRule })
      .from(PolicyTagApplication)
      .innerJoin(
        PolicyTagRule,
        eq(PolicyTagApplication.ruleId, PolicyTagRule.id),
      )
      .where(where)
      .orderBy(
        asc(PolicyTagApplication.ruleId),
        asc(PolicyTagApplication.position),
        asc(PolicyTagApplication.createdAt),
        asc(PolicyTagApplication.unitId),
      )
      .limit(limit)
      .offset(offset);
    const [totalRow] = await db
      .select({ total: count() })
      .from(PolicyTagApplication)
      .innerJoin(
        PolicyTagRule,
        eq(PolicyTagApplication.ruleId, PolicyTagRule.id),
      )
      .where(where);
    return {
      rows: rows.map(({ application, rule }) => ({ ...application, rule })),
      total: totalRow?.total ?? 0,
    };
  }

  async listAppliedUnitIdsForSearch(input: {
    scope: { kind: "global" } | { kind: "realm"; realmUnitId: string };
    tagUnitIds: readonly string[];
  }) {
    const tagUnitIds = [...new Set(input.tagUnitIds.filter(Boolean))];
    if (tagUnitIds.length === 0) return [];
    const db = await getServerDb();
    const filters = [
      eq(PolicyTagRule.state, "ACTIVE" as const),
      eq(PolicyTagRule.scopeKind, input.scope.kind),
      inArray(PolicyTagRule.tagUnitId, tagUnitIds),
    ];
    if (input.scope.kind === "realm") {
      filters.push(eq(PolicyTagRule.realmUnitId, input.scope.realmUnitId));
    }
    const rows = await db
      .select({
        unitId: PolicyTagApplication.unitId,
        tagUnitId: PolicyTagRule.tagUnitId,
      })
      .from(PolicyTagApplication)
      .innerJoin(
        PolicyTagRule,
        eq(PolicyTagApplication.ruleId, PolicyTagRule.id),
      )
      .where(and(...filters));
    const required = new Set(tagUnitIds);
    const matchedTagsByUnit = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = matchedTagsByUnit.get(row.unitId) ?? new Set<string>();
      set.add(row.tagUnitId);
      matchedTagsByUnit.set(row.unitId, set);
    }
    return [...matchedTagsByUnit]
      .filter(([, matched]) =>
        [...required].every((tagUnitId) => matched.has(tagUnitId)),
      )
      .map(([unitId]) => unitId);
  }

  private async getApplicationWithRule(ruleId: string, unitId: string) {
    const db = await getServerDb();
    const [row] = await db
      .select({ application: PolicyTagApplication, rule: PolicyTagRule })
      .from(PolicyTagApplication)
      .innerJoin(
        PolicyTagRule,
        eq(PolicyTagApplication.ruleId, PolicyTagRule.id),
      )
      .where(
        and(
          eq(PolicyTagApplication.ruleId, ruleId),
          eq(PolicyTagApplication.unitId, unitId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new PolicyTagError(
        "APPLICATION_NOT_FOUND",
        "Policy tag application not found",
        404,
      );
    }
    return { ...row.application, rule: row.rule };
  }

  private async assertActiveRule(ruleId: string): Promise<PolicyTagRuleRow> {
    const row = await this.getRule(ruleId);
    if (row.state !== "ACTIVE") {
      throw new PolicyTagError(
        "RULE_ARCHIVED",
        "Archived policy tag rules cannot be mutated",
        409,
      );
    }
    return row;
  }

  private async assertTagUnit(tagUnitId: string) {
    const db = await getServerDb();
    const [tag] = await db
      .select({ id: Unit.id })
      .from(Unit)
      .where(and(eq(Unit.id, tagUnitId), eq(Unit.type, "TAG")))
      .limit(1);
    if (!tag) {
      throw new PolicyTagError("TAG_NOT_FOUND", "Tag Unit not found", 404);
    }
  }
}

export const policyTagService = new PolicyTagService();
