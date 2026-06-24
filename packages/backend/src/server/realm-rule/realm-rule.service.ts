import type {
  AcknowledgeRealmRuleInput,
  CreateRealmRuleRevisionInput,
  RealmRuleAcknowledgementDTO,
  RealmRuleAcknowledgementStatus,
  RealmRulePolicyDTO,
  RealmRuleResolvedDTO,
  RezicsSessionClaims,
  UpdateRealmRulePolicyInput,
} from "@rezics/contract";
import { normalizeContentLanguage } from "@rezics/contract";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { realmPolicyActions } from "@/governance/action/realm";
import { governanceAuditService } from "@/governance/audit.service";
import { mapPostToDTO } from "@/post/post.mapper";
import { postService } from "@/post/post.service";
import { resolveReadLanguage } from "@rezics/contract";
import {
  Realm,
  RealmRuleAcknowledgement,
  RealmRuleItem,
  RealmRulePolicy,
  RealmRuleRevision,
  Unit,
  UnitSupportLanguage,
} from "../db/schema";
import {
  emptyRealmRuleRequirements,
  mapRealmRuleAcknowledgementToDTO,
  mapRealmRuleItemToDTO,
  mapRealmRulePolicyToDTO,
  mapRealmRuleRevisionToDTO,
} from "./realm-rule.mapper";

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function normalizedLanguage(language: string | null | undefined) {
  return language ? normalizeContentLanguage(language) : null;
}

function notifyRealmRuleUpdated(input: {
  actorUserId: string;
  realmUnitId: string;
  policyId: string | null;
  revisionId: string | null;
  version: number | null;
}) {
  void import("@/notify-boundary/notify-boundary.client")
    .then(({ broadcast }) =>
      broadcast({
        kind: "realm.rules.updated",
        sourceUnitId: input.realmUnitId,
        actorId: input.actorUserId,
        extra: {
          policyId: input.policyId,
          revisionId: input.revisionId,
          version: input.version,
        },
      }),
    )
    .catch(() => {});
}

export class RealmRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "RealmRuleError";
  }
}

export class RealmRuleService {
  async getPolicy(realmUnitId: string): Promise<RealmRulePolicyDTO> {
    const db = await getServerDb();
    const [realm] = await db
      .select({ unitId: Realm.unitId })
      .from(Realm)
      .where(eq(Realm.unitId, realmUnitId))
      .limit(1);
    if (!realm)
      throw new RealmRuleError("REALM_NOT_FOUND", "Realm not found", 404);

    const [policy] = await db
      .select()
      .from(RealmRulePolicy)
      .where(eq(RealmRulePolicy.realmUnitId, realmUnitId))
      .limit(1);
    if (!policy) return mapRealmRulePolicyToDTO(realmUnitId, null);

    const currentRevision = policy.currentRevisionId
      ? await db
          .select({
            id: RealmRuleRevision.id,
            version: RealmRuleRevision.version,
          })
          .from(RealmRuleRevision)
          .where(eq(RealmRuleRevision.id, policy.currentRevisionId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;

    return mapRealmRulePolicyToDTO(realmUnitId, policy, currentRevision);
  }

  async resolve(
    realmUnitId: string,
    language?: string,
    languages: readonly string[] = [],
  ): Promise<RealmRuleResolvedDTO> {
    const policy = await this.getPolicy(realmUnitId);
    if (!policy.policyId || !policy.currentRevisionId) {
      return { policy, revision: null, items: [] };
    }

    const db = await getServerDb();
    const [revision, items] = await Promise.all([
      db
        .select()
        .from(RealmRuleRevision)
        .where(eq(RealmRuleRevision.id, policy.currentRevisionId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select()
        .from(RealmRuleItem)
        .where(eq(RealmRuleItem.revisionId, policy.currentRevisionId))
        .orderBy(RealmRuleItem.position),
    ]);
    if (!revision) return { policy, revision: null, items: [] };

    const rulePostIds = items.map((item) => item.rulePostUnitId);
    const supportLanguageRows = rulePostIds.length
      ? await db
          .select()
          .from(UnitSupportLanguage)
          .where(inArray(UnitSupportLanguage.unitId, rulePostIds))
      : [];
    const supportLanguagesByUnit = new Map<
      string,
      typeof supportLanguageRows
    >();
    for (const row of supportLanguageRows) {
      const rows = supportLanguagesByUnit.get(row.unitId) ?? [];
      rows.push(row);
      supportLanguagesByUnit.set(row.unitId, rows);
    }

    const requestedLanguage = normalizedLanguage(language ?? languages[0]);
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        const resolvedLanguage = resolveReadLanguage({
          explicitLanguage: language,
          languages,
          supportLanguages:
            supportLanguagesByUnit.get(item.rulePostUnitId) ?? [],
        });
        const sourceRulePost = await postService.getByUnitId(
          item.rulePostUnitId,
          {
            allowTombstone: true,
          },
        );
        return {
          ...mapRealmRuleItemToDTO(item),
          requestedLanguage,
          resolvedLanguage: normalizedLanguage(resolvedLanguage),
          sourceRulePost: sourceRulePost
            ? mapPostToDTO(
                sourceRulePost,
                undefined,
                [language, ...languages].filter(
                  (value): value is string => !!value,
                ),
              )
            : null,
        };
      }),
    );

    return {
      policy,
      revision: mapRealmRuleRevisionToDTO(revision, items),
      items: resolvedItems,
    };
  }

  async updatePolicy(
    caller: RezicsSessionClaims,
    realmUnitId: string,
    input: UpdateRealmRulePolicyInput,
  ): Promise<RealmRulePolicyDTO> {
    const db = await getServerDb();
    const policy = await db.transaction(async (tx) => {
      const [realm] = await tx
        .select({ unitId: Realm.unitId })
        .from(Realm)
        .where(eq(Realm.unitId, realmUnitId))
        .limit(1);
      if (!realm)
        throw new RealmRuleError("REALM_NOT_FOUND", "Realm not found", 404);

      const [existing] = await tx
        .select()
        .from(RealmRulePolicy)
        .where(eq(RealmRulePolicy.realmUnitId, realmUnitId))
        .limit(1);
      if (!existing) {
        const [created] = await tx
          .insert(RealmRulePolicy)
          .values({
            realmUnitId,
            requireOnJoin:
              input.requireOnJoin ?? emptyRealmRuleRequirements.requireOnJoin,
            requireOnPost:
              input.requireOnPost ?? emptyRealmRuleRequirements.requireOnPost,
            requireOnUpdate:
              input.requireOnUpdate ??
              emptyRealmRuleRequirements.requireOnUpdate,
            updatedAt: new Date(),
          })
          .returning();
        if (!created)
          throw new RealmRuleError(
            "POLICY_WRITE_FAILED",
            "Failed to create rule policy",
          );
        return created;
      }

      const [updated] = await tx
        .update(RealmRulePolicy)
        .set({
          requireOnJoin: input.requireOnJoin ?? undefined,
          requireOnPost: input.requireOnPost ?? undefined,
          requireOnUpdate: input.requireOnUpdate ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(RealmRulePolicy.id, existing.id))
        .returning();
      if (!updated)
        throw new RealmRuleError(
          "POLICY_WRITE_FAILED",
          "Failed to update rule policy",
        );
      return updated;
    });

    await governanceAuditService.appendPrivilegedMutation({
      actorUserId: caller.userId,
      action: realmPolicyActions.rulesUpdate,
      targetKind: "realm-rules",
      targetId: realmUnitId,
      reason: "Realm rule policy update",
      correlationId: crypto.randomUUID(),
      metadata: {
        policyId: policy.id,
        requireOnJoin: policy.requireOnJoin,
        requireOnPost: policy.requireOnPost,
        requireOnUpdate: policy.requireOnUpdate,
      },
    });

    const dto = await this.getPolicy(realmUnitId);
    notifyRealmRuleUpdated({
      actorUserId: caller.userId,
      realmUnitId,
      policyId: dto.policyId,
      revisionId: dto.currentRevisionId,
      version: dto.currentVersion,
    });
    return dto;
  }

  async createRevision(
    caller: RezicsSessionClaims,
    realmUnitId: string,
    input: CreateRealmRuleRevisionInput,
  ): Promise<RealmRuleResolvedDTO> {
    const db = await getServerDb();
    await db.transaction(async (tx) => {
      const [realm] = await tx
        .select({ unitId: Realm.unitId })
        .from(Realm)
        .where(eq(Realm.unitId, realmUnitId))
        .limit(1);
      if (!realm)
        throw new RealmRuleError("REALM_NOT_FOUND", "Realm not found", 404);

      const rulePostIds = input.items.map((item) => item.rulePostUnitId);
      if (rulePostIds.length) {
        const rows = await tx
          .select({ id: Unit.id, type: Unit.type })
          .from(Unit)
          .where(inArray(Unit.id, rulePostIds));
        const postIds = new Set(
          rows.filter((row) => row.type === "POST").map((row) => row.id),
        );
        const missing = rulePostIds.filter((id) => !postIds.has(id));
        if (missing.length) {
          throw new RealmRuleError(
            "INVALID_RULE_POST",
            `Rule items must reference POST Units: ${missing.join(", ")}`,
          );
        }
      }

      let [policy] = await tx
        .select()
        .from(RealmRulePolicy)
        .where(eq(RealmRulePolicy.realmUnitId, realmUnitId))
        .limit(1);
      if (!policy) {
        [policy] = await tx
          .insert(RealmRulePolicy)
          .values({ realmUnitId, updatedAt: new Date() })
          .returning();
      }
      if (!policy)
        throw new RealmRuleError(
          "POLICY_WRITE_FAILED",
          "Failed to create rule policy",
        );

      const [versionRow] = await tx
        .select({
          version: sql<number>`coalesce(max(${RealmRuleRevision.version}), 0) + 1`,
        })
        .from(RealmRuleRevision)
        .where(eq(RealmRuleRevision.policyId, policy.id));
      const version = Number(versionRow?.version ?? 1);
      const [revision] = await tx
        .insert(RealmRuleRevision)
        .values({
          policyId: policy.id,
          version,
          createdByUserId: caller.userId,
        })
        .returning();
      if (!revision)
        throw new RealmRuleError(
          "REVISION_WRITE_FAILED",
          "Failed to create rule revision",
        );

      if (input.items.length) {
        await tx.insert(RealmRuleItem).values(
          input.items.map((item, index) => ({
            policyId: policy.id,
            revisionId: revision.id,
            rulePostUnitId: item.rulePostUnitId,
            position: item.position || String(index + 1).padStart(4, "0"),
            appliesTo: item.appliesTo ?? null,
            reportReasonUnitId: item.reportReasonUnitId ?? null,
            updatedAt: new Date(),
          })),
        );
      }

      await tx
        .update(RealmRulePolicy)
        .set({ currentRevisionId: revision.id, updatedAt: new Date() })
        .where(eq(RealmRulePolicy.id, policy.id));
    });

    const resolved = await this.resolve(realmUnitId);
    notifyRealmRuleUpdated({
      actorUserId: caller.userId,
      realmUnitId,
      policyId: resolved.policy.policyId,
      revisionId: resolved.policy.currentRevisionId,
      version: resolved.policy.currentVersion,
    });
    return resolved;
  }

  async acknowledgeCurrent(
    realmUnitId: string,
    userId: string,
    input: AcknowledgeRealmRuleInput = {},
  ): Promise<RealmRuleAcknowledgementDTO> {
    const db = await getServerDb();
    const [row] = await db
      .select({
        policyId: RealmRulePolicy.id,
        revisionId: RealmRuleRevision.id,
        version: RealmRuleRevision.version,
      })
      .from(RealmRulePolicy)
      .innerJoin(
        RealmRuleRevision,
        eq(RealmRuleRevision.id, RealmRulePolicy.currentRevisionId),
      )
      .where(eq(RealmRulePolicy.realmUnitId, realmUnitId))
      .limit(1);
    if (!row)
      throw new RealmRuleError(
        "NO_CURRENT_RULES",
        "Realm does not have current rules",
      );

    const [ack] = await db
      .insert(RealmRuleAcknowledgement)
      .values({
        realmUnitId,
        policyId: row.policyId,
        revisionId: row.revisionId,
        version: row.version,
        userId,
        acceptedLanguage: normalizedLanguage(input.acceptedLanguage),
      })
      .onConflictDoUpdate({
        target: [
          RealmRuleAcknowledgement.realmUnitId,
          RealmRuleAcknowledgement.policyId,
          RealmRuleAcknowledgement.revisionId,
          RealmRuleAcknowledgement.userId,
        ],
        set: {
          acceptedAt: new Date(),
          acceptedLanguage: normalizedLanguage(input.acceptedLanguage),
        },
      })
      .returning();
    if (!ack)
      throw new RealmRuleError(
        "ACK_WRITE_FAILED",
        "Failed to acknowledge realm rules",
      );
    return mapRealmRuleAcknowledgementToDTO(ack);
  }

  async getAcknowledgementStatus(
    realmUnitId: string,
    userId: string,
  ): Promise<RealmRuleAcknowledgementStatus> {
    const db = await getServerDb();
    const [current, latestAcknowledgement] = await Promise.all([
      db
        .select({
          policyId: RealmRulePolicy.id,
          revisionId: RealmRuleRevision.id,
          version: RealmRuleRevision.version,
          requireOnJoin: RealmRulePolicy.requireOnJoin,
          requireOnPost: RealmRulePolicy.requireOnPost,
          requireOnUpdate: RealmRulePolicy.requireOnUpdate,
        })
        .from(RealmRulePolicy)
        .innerJoin(
          RealmRuleRevision,
          eq(RealmRuleRevision.id, RealmRulePolicy.currentRevisionId),
        )
        .where(eq(RealmRulePolicy.realmUnitId, realmUnitId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select()
        .from(RealmRuleAcknowledgement)
        .where(
          and(
            eq(RealmRuleAcknowledgement.realmUnitId, realmUnitId),
            eq(RealmRuleAcknowledgement.userId, userId),
          ),
        )
        .orderBy(
          desc(RealmRuleAcknowledgement.acceptedAt),
          desc(RealmRuleAcknowledgement.version),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);
    const hasCurrentAck = Boolean(
      current &&
        latestAcknowledgement?.policyId === current.policyId &&
        latestAcknowledgement?.revisionId === current.revisionId &&
        latestAcknowledgement.version >= current.version,
    );
    const requirementEnabled = Boolean(
      current?.requireOnJoin ||
        current?.requireOnPost ||
        current?.requireOnUpdate,
    );

    return {
      currentPolicyId: current?.policyId ?? null,
      currentRevisionId: current?.revisionId ?? null,
      requiredVersion: current?.version ?? null,
      acceptedPolicyId: latestAcknowledgement?.policyId ?? null,
      acceptedRevisionId: latestAcknowledgement?.revisionId ?? null,
      acceptedVersion: latestAcknowledgement?.version ?? null,
      acceptedAt: latestAcknowledgement?.acceptedAt ?? null,
      acceptedLanguage: normalizedLanguage(
        latestAcknowledgement?.acceptedLanguage,
      ),
      acknowledgementRequired: Boolean(
        current && requirementEnabled && !hasCurrentAck,
      ),
    };
  }

  async assertAcknowledgedForAction(
    realmUnitId: string,
    userId: string,
    action: "join" | "post" | "update",
  ): Promise<void> {
    const db = await getServerDb();
    const [current] = await db
      .select({
        policyId: RealmRulePolicy.id,
        revisionId: RealmRuleRevision.id,
        version: RealmRuleRevision.version,
        requireOnJoin: RealmRulePolicy.requireOnJoin,
        requireOnPost: RealmRulePolicy.requireOnPost,
        requireOnUpdate: RealmRulePolicy.requireOnUpdate,
      })
      .from(RealmRulePolicy)
      .innerJoin(
        RealmRuleRevision,
        eq(RealmRuleRevision.id, RealmRulePolicy.currentRevisionId),
      )
      .where(eq(RealmRulePolicy.realmUnitId, realmUnitId))
      .limit(1);
    if (!current) return;

    const requires =
      action === "join"
        ? current.requireOnJoin
        : action === "post"
          ? current.requireOnPost
          : current.requireOnUpdate;
    if (!requires) return;

    const [ack] = await db
      .select({ revisionId: RealmRuleAcknowledgement.revisionId })
      .from(RealmRuleAcknowledgement)
      .where(
        and(
          eq(RealmRuleAcknowledgement.realmUnitId, realmUnitId),
          eq(RealmRuleAcknowledgement.policyId, current.policyId),
          eq(RealmRuleAcknowledgement.revisionId, current.revisionId),
          eq(RealmRuleAcknowledgement.version, current.version),
          eq(RealmRuleAcknowledgement.userId, userId),
        ),
      )
      .limit(1);
    if (!ack) {
      throw new RealmRuleError(
        "RULE_ACKNOWLEDGEMENT_REQUIRED",
        `Realm rules must be acknowledged before ${action}`,
        403,
      );
    }
  }
}

export const realmRuleService = new RealmRuleService();
