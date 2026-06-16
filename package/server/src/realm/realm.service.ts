import type {
  AcknowledgeRealmRuleInput,
  AddUnitRealmInput,
  CreateRealmInput,
  RealmDTO,
  RealmExtraAdminReadResponse,
  RealmExtraOkResponse,
  RealmExtraReadResponse,
  RealmListQuery,
  ListLanguageMode,
  RealmMemberDTO,
  RealmMemberListQuery,
  RealmMemberListResponse,
  RealmMembershipMeDTO,
  RealmRuleAcknowledgementDTO,
  RealmRuleReferenceDTO,
  RealmRuleResolvedDTO,
  RezicsSessionClaims,
  UnitRealmDTO,
  UpdateRealmInput,
  UpdateRealmRulePolicyInput,
} from "@rezics/contract";
import {
  normalizeLanguage,
  parseIdsCsv,
  resolveReadLanguage,
  validateSlug,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { nullableContentDocJson } from "@/content-doc/json-write";
import { realmPolicyActions } from "@/governance/action/realm";
import { governanceAuditService } from "@/governance/audit.service";
import { governanceCapabilityService } from "@/governance/capability.service";
import { moderationActionService } from "@/governance/moderation-action.service";
import { serverJobProducer } from "@/job/job-boundary";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
import { mapPostToDTO } from "@/post/post.mapper";
import { postService } from "@/post/post.service";
import type { EffectiveReadLanguageInput } from "@/unit/language-resolution";
import {
  resolveEffectiveReadLanguageCandidates,
  resolveEffectiveReadLanguageInput,
} from "@/unit/language-resolution";
import { mapTranslationToDTO } from "@/unit/mapper";
import { mapPublicUser } from "@/utils/sanitizeUser";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
  loadUserSlugMap,
} from "@/utils/userSlugHydration";
import type { ServerDb } from "../db/client";
import {
  Realm,
  RealmMember,
  RealmRuleAcknowledgement,
  RealmTagApplication as RealmTagApplicationTable,
  RealmTagApplicationVote,
  Subscription,
  TagVote,
  Unit,
  UnitRealm,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
} from "../db/schema";
import {
  mapRealmMemberToDTO,
  mapRealmToDTO,
  mapUnitRealmToDTO,
} from "./realm.mapper";
import {
  appendToList,
  clearSingleExtraKey,
  filterRealmExtraPublic,
  readListAdmin,
  readListPublic,
  removeFromList,
  reorderList,
  setSingleExtraKey,
} from "./realm-extra.service";
import type { RealmWithRelations } from "./types";

/**
 * Score at or below this threshold hides a RealmTagApplication from regular users.
 * 分数低于或等于此阈值时，会对普通用户隐藏该 RealmTagApplication。
 */
export const REALM_TAG_VISIBILITY_THRESHOLD = -100;

function normalizedLanguage(language: string | null | undefined) {
  return language ? normalizeLanguage(language) : null;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

type RealmTagApplicationRow = typeof RealmTagApplicationTable.$inferSelect;

const publicUserColumns = {
  unitId: User.unitId,
  name: User.name,
  avatar: User.avatar,
  bio: User.bio,
  description: User.description,
  followersCount: User.followersCount,
  followingsCount: User.followingsCount,
};

async function hydrateRealmWithRelations(
  unitId: string,
  dbLike?: Pick<ServerDb, "select">,
): Promise<RealmWithRelations> {
  const db = dbLike ?? (await getServerDb());
  const [realm] = await db
    .select()
    .from(Realm)
    .where(eq(Realm.unitId, unitId))
    .limit(1);
  if (!realm) throw new Error("Realm not found");

  const [unit] = await db
    .select()
    .from(Unit)
    .where(eq(Unit.id, unitId))
    .limit(1);
  if (!unit) throw new Error("Realm Unit not found");

  const [translations, supportLanguages, members, users] = await Promise.all([
    db.select().from(UnitTranslation).where(eq(UnitTranslation.unitId, unitId)),
    db
      .select()
      .from(UnitSupportLanguage)
      .where(eq(UnitSupportLanguage.unitId, unitId)),
    db.select().from(RealmMember).where(eq(RealmMember.realmUnitId, unitId)),
    unit.userId
      ? db
          .select(publicUserColumns)
          .from(User)
          .where(eq(User.unitId, unit.userId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    ...realm,
    unit: {
      ...unit,
      user: users[0] ?? null,
      translations,
      supportLanguages,
    },
    members,
  };
}

function enqueueRealmSearch(
  kind:
    | typeof SEARCH_COMMAND_KINDS.realmSync
    | typeof SEARCH_COMMAND_KINDS.realmPatchMemberCount,
  unitId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(kind, { unitId }, { type: "server", service: "realm" }),
  );
}

function enqueueContentSearch(
  kind:
    | typeof SEARCH_COMMAND_KINDS.contentPatchRealmIds
    | typeof SEARCH_COMMAND_KINDS.contentPatchRealmTagKeys
    | typeof SEARCH_COMMAND_KINDS.contentPatchTags,
  unitId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(kind, { unitId }, { type: "server", service: "realm" }),
  );
}

function enqueuePostSync(unitId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.postSync,
      { postId: unitId },
      { type: "server", service: "realm" },
    ),
  );
}

function enqueueRealmMetadata(unitId: string, fields: Record<string, unknown>) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.realmPatchMetadata,
      { targetId: unitId, fields },
      { type: "server", service: "realm" },
    ),
  );
}

function getRuleUnitIdFromExtra(extra: unknown): string | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const rule = (extra as Record<string, unknown>).rule;
  return typeof rule === "string" && rule.length > 0 ? rule : null;
}

type RealmCommunityListKey = "pinboard" | "announcement";

function communityListTargetKind(key: RealmCommunityListKey) {
  return key === "pinboard" ? "realm-pinboard" : "realm-announcement";
}

const REALM_JOIN_APPROVAL_ROLES = ["owner", "admin", "moderator"] as const;

function notifyRealmRuleUpdated(input: {
  actorUserId: string;
  realmUnitId: string;
  ruleUnitId: string | null;
  version: number;
}) {
  void broadcast({
    kind: "realm.rules.updated",
    sourceUnitId: input.realmUnitId,
    actorId: input.actorUserId,
    extra: {
      ruleUnitId: input.ruleUnitId,
      version: input.version,
    },
  }).catch(() => {});
}

export class RealmService {
  private async notifyJoinApprovalRequested(input: {
    realmUnitId: string;
    requesterUserId: string;
  }): Promise<void> {
    const db = await getServerDb();
    const recipients = await db
      .select({ userId: RealmMember.userId })
      .from(RealmMember)
      .where(
        and(
          eq(RealmMember.realmUnitId, input.realmUnitId),
          eq(RealmMember.state, "ACTIVE"),
          inArray(RealmMember.roleKey, [...REALM_JOIN_APPROVAL_ROLES]),
          ne(RealmMember.userId, input.requesterUserId),
        ),
      );
    const directRecipients = recipients.map((recipient) => recipient.userId);
    if (directRecipients.length === 0) return;

    void broadcast({
      kind: "realm.join.requested",
      sourceUnitId: input.realmUnitId,
      directRecipients,
      directOnly: true,
      actorId: input.requesterUserId,
      extra: {
        memberUserId: input.requesterUserId,
      },
    }).catch(() => {});
  }

  private async assertRealmAndTagTypes(
    realmUnitId: string,
    tagUnitId: string,
    tx?: Pick<ServerDb, "select">,
  ): Promise<void> {
    const db = tx ?? (await getServerDb());
    const [realm, tag] = await Promise.all([
      db
        .select({ id: Unit.id, type: Unit.type, realmUnitId: Realm.unitId })
        .from(Unit)
        .leftJoin(Realm, eq(Realm.unitId, Unit.id))
        .where(eq(Unit.id, realmUnitId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ id: Unit.id, type: Unit.type })
        .from(Unit)
        .where(eq(Unit.id, tagUnitId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    if (!realm || realm.type !== "REALM" || !realm.realmUnitId) {
      throw new Error("realmUnitId must reference an existing REALM Unit");
    }
    if (!tag || tag.type !== "TAG") {
      throw new Error("tagUnitId must reference an existing TAG Unit");
    }
  }

  private async patchPostRealmIds(unitId: string): Promise<void> {
    await enqueuePostSync(unitId);
  }

  // --- Realm CRUD ---
  // --- Realm 增删改查 ---

  private async resolveViewerCapabilities(
    realmUnitId: string,
    viewerUserId?: string | null,
  ) {
    if (!viewerUserId) return [];

    const policyMembership =
      await governanceCapabilityService.realmMembershipForPolicy(
        realmUnitId,
        viewerUserId,
      );
    return policyMembership?.capabilities ?? [];
  }

  async list(
    options: RealmListQuery = {},
  ): Promise<{ realms: RealmDTO[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skipNum = options.start ?? 0;
    const db = await getServerDb();
    const conditions: SQL[] = [
      eq(Unit.status, "PUBLISHED"),
      eq(Unit.type, "REALM"),
    ];

    if (options.userId?.trim()) {
      conditions.push(eq(Unit.userId, options.userId));
    }
    if (options.isPublic !== undefined) {
      conditions.push(eq(Realm.isPublic, options.isPublic));
    }
    if (options.isOfficial !== undefined) {
      conditions.push(eq(Realm.isOfficial, options.isOfficial));
    }

    const readLanguages = resolveEffectiveReadLanguageCandidates({
      languages: (options as { languages?: string | readonly string[] })
        .languages,
      appLocale: (options as { appLocale?: string }).appLocale,
    });
    if (options.languageMode === "preferred" && readLanguages.length > 0) {
      conditions.push(
        or(
          eq(Unit.isLanguageNeutral, true),
          sql`exists (
            select 1
            from "UnitSupportLanguage" usl
            where usl."unitId" = ${Unit.id}
              and usl."language" in (${sql.join(
                readLanguages.map((language) => sql`${language}`),
                sql`, `,
              )})
          )`,
        )!,
      );
    }

    const idList = parseIdsCsv(options.ids);
    if (idList && idList.length > 0) {
      conditions.push(inArray(Realm.unitId, idList));
    }

    const where = and(...conditions);
    const order = (options.sort?.order ?? "desc") as "asc" | "desc";
    const direction = order === "asc" ? asc : desc;
    const sortField = options.sort?.field ?? "createdAt";
    const sortColumn =
      sortField === "memberCount"
        ? Realm.memberCount
        : sortField === "updatedAt"
          ? Unit.updatedAt
          : Unit.createdAt;

    const [rows, totalRows] = await Promise.all([
      db
        .select({ unitId: Realm.unitId })
        .from(Realm)
        .innerJoin(Unit, eq(Realm.unitId, Unit.id))
        .where(where)
        .orderBy(direction(sortColumn), desc(Realm.unitId))
        .offset(skipNum)
        .limit(limitNum),
      db
        .select({ total: count() })
        .from(Realm)
        .innerJoin(Unit, eq(Realm.unitId, Unit.id))
        .where(where),
    ]);
    const hydratedRows = await hydrateUnitOwnerUserSlugs(
      await Promise.all(
        rows.map((row) => hydrateRealmWithRelations(row.unitId)),
      ),
    );
    const readLanguage = resolveEffectiveReadLanguageInput({
      languages: (options as { languages?: string | readonly string[] })
        .languages,
      appLocale: (options as { appLocale?: string }).appLocale,
    });

    return {
      realms: await Promise.all(
        hydratedRows.map(async (row) => {
          const dto = mapRealmToDTO(row, readLanguage);
          return {
            ...dto,
            extra: await filterRealmExtraPublic(dto.extra),
          };
        }),
      ),
      total: totalRows[0]?.total ?? 0,
    };
  }

  async getByUnitId(
    unitId: string,
    viewerUserId?: string | null,
    readLanguage: EffectiveReadLanguageInput | readonly string[] = {},
  ): Promise<RealmDTO> {
    const row = await hydrateRealmWithRelations(unitId);
    const dto = mapRealmToDTO(
      await hydrateUnitOwnerUserSlugRow(row),
      readLanguage,
    );
    return {
      ...dto,
      extra: await filterRealmExtraPublic(dto.extra),
      viewerCapabilities: await this.resolveViewerCapabilities(
        unitId,
        viewerUserId,
      ),
    };
  }

  async create(
    req: CreateRealmInput & { slug?: string },
    userId: string,
  ): Promise<RealmDTO> {
    const { isPublic, contentRequiresApproval, extra, translations } = req;

    let normalizedSlug: string | undefined;
    if (req.slug) {
      const validation = validateSlug(req.slug);
      if (!validation.ok) throw new Error(`Invalid slug: ${validation.reason}`);
      normalizedSlug = validation.normalized;
    }

    const { requireSlugScopeId } = await import("@/infra/slug-scopes");
    const realmScope = requireSlugScopeId("realm");
    const db = await getServerDb();
    const row = await db.transaction(async (tx) => {
      const [unit] = await tx
        .insert(Unit)
        .values({
          userId,
          slugScope: realmScope,
          type: "REALM",
          status: "PUBLISHED",
          updatedAt: new Date(),
          ...(normalizedSlug ? { slug: normalizedSlug } : {}),
        })
        .returning({ id: Unit.id });
      if (!unit) throw new Error("Failed to create realm Unit");

      if (translations?.length) {
        await tx.insert(UnitTranslation).values(
          translations.map((tr) => ({
            unitId: unit.id,
            language: tr.language,
            title: tr.title,
            subtitle: tr.subtitle,
            summary: tr.summary,
            description: nullableContentDocJson(tr.description),
            updatedAt: new Date(),
          })),
        );
      }

      const [realm] = await tx
        .insert(Realm)
        .values({
          unitId: unit.id,
          isPublic: isPublic ?? true,
          contentRequiresApproval: contentRequiresApproval ?? false,
          extra: extra ?? undefined,
          memberCount: 1,
          updatedAt: new Date(),
        })
        .returning({ unitId: Realm.unitId });
      if (!realm) throw new Error("Failed to create realm");

      await tx.insert(RealmMember).values({
        realmUnitId: unit.id,
        userId,
        roleKey: "owner",
        updatedAt: new Date(),
      });

      return hydrateRealmWithRelations(unit.id, tx);
    });

    await enqueueRealmSearch(SEARCH_COMMAND_KINDS.realmSync, row.unitId);

    const dto = mapRealmToDTO(await hydrateUnitOwnerUserSlugRow(row));
    return {
      ...dto,
      extra: await filterRealmExtraPublic(dto.extra),
    };
  }

  async update(unitId: string, req: UpdateRealmInput): Promise<RealmDTO> {
    const { isPublic, isOfficial, contentRequiresApproval, extra } = req;

    const db = await getServerDb();
    const [updated] = await db
      .update(Realm)
      .set({
        isPublic: isPublic !== undefined ? isPublic : undefined,
        isOfficial: isOfficial !== undefined ? isOfficial : undefined,
        contentRequiresApproval:
          contentRequiresApproval !== undefined
            ? contentRequiresApproval
            : undefined,
        extra: extra !== undefined ? (extra ?? undefined) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(Realm.unitId, unitId))
      .returning({ unitId: Realm.unitId });
    if (!updated) throw new Error("Realm not found");
    const row = await hydrateRealmWithRelations(unitId);

    const patchFields: Record<string, any> = {};
    if (isPublic !== undefined) patchFields.isPublic = isPublic;
    if (isOfficial !== undefined) patchFields.isOfficial = isOfficial;
    if (contentRequiresApproval !== undefined) {
      patchFields.contentRequiresApproval = contentRequiresApproval;
    }
    if (extra !== undefined) patchFields.extra = extra;
    await enqueueRealmMetadata(unitId, patchFields);

    const dto = mapRealmToDTO(await hydrateUnitOwnerUserSlugRow(row));
    return {
      ...dto,
      extra: await filterRealmExtraPublic(dto.extra),
    };
  }

  async delete(unitId: string): Promise<void> {
    const db = await getServerDb();
    await db.delete(Unit).where(eq(Unit.id, unitId));
  }

  // --- Membership ---
  // --- 成员关系 ---

  /**
   * Join the realm as a member. Atomically writes BOTH the `RealmMember`
   * permission edge AND the `Subscription` attention edge (channels=['*']).
   * Bumps both denormalized
   * counters (`Realm.memberCount` and `Unit.subscriberCount`) in the same
   * transaction. If a Subscription row already exists (the user was
   * lurking on a public realm and is now joining), the upsert keeps it
   * intact and the subscriberCount stays accurate.
   * 以成员身份加入 realm。在同一事务中原子地写入 `RealmMember` 权限边
   * 和 `Subscription` 关注边（channels=['*']），并同时递增两个去规范化
   * 计数器（`Realm.memberCount` 和 `Unit.subscriberCount`）。若 Subscription
   * 行已存在（用户先前在公开 realm 上潜水、现在才加入），upsert 会保留它，
   * 使 subscriberCount 保持准确。
   */
  async joinRealm(
    realmUnitId: string,
    userId: string,
    roleKey?: string,
  ): Promise<RealmMemberDTO> {
    const db = await getServerDb();
    const { member } = await db.transaction(async (tx) => {
      const [realmPolicy] = await tx
        .select({
          extra: Realm.extra,
          ruleVersion: Realm.ruleVersion,
          ruleRequireOnJoin: Realm.ruleRequireOnJoin,
          joinRequiresApproval: Realm.joinRequiresApproval,
        })
        .from(Realm)
        .where(eq(Realm.unitId, realmUnitId))
        .limit(1);
      const ruleUnitId = getRuleUnitIdFromExtra(realmPolicy?.extra ?? null);
      if (realmPolicy?.ruleRequireOnJoin && ruleUnitId) {
        const [acknowledgement] = await tx
          .select({ realmUnitId: RealmRuleAcknowledgement.realmUnitId })
          .from(RealmRuleAcknowledgement)
          .where(
            and(
              eq(RealmRuleAcknowledgement.realmUnitId, realmUnitId),
              eq(RealmRuleAcknowledgement.ruleUnitId, ruleUnitId),
              eq(RealmRuleAcknowledgement.version, realmPolicy.ruleVersion),
              eq(RealmRuleAcknowledgement.userId, userId),
            ),
          )
          .limit(1);
        if (!acknowledgement) {
          throw new Error("Realm rules must be acknowledged before joining");
        }
      }

      const [member] = await tx
        .insert(RealmMember)
        .values({
          realmUnitId,
          userId,
          roleKey: roleKey ?? "member",
          state: realmPolicy?.joinRequiresApproval ? "PENDING" : "ACTIVE",
          onboardingCompletedAt: realmPolicy?.joinRequiresApproval
            ? null
            : new Date(),
          updatedAt: new Date(),
        })
        .returning();
      if (!member) throw new Error("Failed to join realm");

      const [updatedRealm] = await tx
        .update(Realm)
        .set({
          memberCount: sql`${Realm.memberCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(Realm.unitId, realmUnitId))
        .returning({ memberCount: Realm.memberCount });
      if (!updatedRealm) throw new Error("Realm not found");

      const [existingSub] = await tx
        .select({ id: Subscription.id })
        .from(Subscription)
        .where(
          and(
            eq(Subscription.subscriberUnitId, userId),
            eq(Subscription.subscribedUnitId, realmUnitId),
          ),
        )
        .limit(1);
      if (!existingSub) {
        await tx.insert(Subscription).values({
          subscriberUnitId: userId,
          subscribedUnitId: realmUnitId,
          channels: ["*"],
          updatedAt: new Date(),
        });
        await tx
          .update(Unit)
          .set({
            subscriberCount: sql`${Unit.subscriberCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(Unit.id, realmUnitId));
      }

      return { member, memberCount: updatedRealm.memberCount };
    });

    await enqueueRealmSearch(
      SEARCH_COMMAND_KINDS.realmPatchMemberCount,
      realmUnitId,
    );
    if (member.state === "PENDING") {
      await this.notifyJoinApprovalRequested({
        realmUnitId,
        requesterUserId: userId,
      });
    }

    return mapRealmMemberToDTO(member);
  }

  async updateMemberRole(
    realmUnitId: string,
    userId: string,
    roleKey: string,
  ): Promise<RealmMemberDTO> {
    const db = await getServerDb();
    const [member] = await db
      .update(RealmMember)
      .set({ roleKey, updatedAt: new Date() })
      .where(
        and(
          eq(RealmMember.realmUnitId, realmUnitId),
          eq(RealmMember.userId, userId),
        ),
      )
      .returning();
    if (!member) throw new Error("Realm member not found");

    return mapRealmMemberToDTO(member);
  }

  async listMembers(
    realmUnitId: string,
    options: RealmMemberListQuery = {},
  ): Promise<RealmMemberListResponse> {
    const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 100));
    const cursorDate = options.cursor ? new Date(options.cursor) : null;
    const db = await getServerDb();
    const rows = await db
      .select()
      .from(RealmMember)
      .where(
        and(
          eq(RealmMember.realmUnitId, realmUnitId),
          cursorDate && !Number.isNaN(cursorDate.getTime())
            ? sql`${RealmMember.joinedAt} < ${cursorDate}`
            : undefined,
        ),
      )
      .orderBy(desc(RealmMember.joinedAt), RealmMember.userId)
      .limit(limit + 1);
    const pageRows = rows.slice(0, limit);
    const users =
      pageRows.length === 0
        ? []
        : await db
            .select({
              unitId: User.unitId,
              name: User.name,
              avatar: User.avatar,
              bio: User.bio,
              description: User.description,
              followersCount: User.followersCount,
              followingsCount: User.followingsCount,
            })
            .from(User)
            .where(
              inArray(
                User.unitId,
                pageRows.map((row) => row.userId),
              ),
            );
    const slugByUserId = await loadUserSlugMap(
      users.map((user) => user.unitId),
    );
    const userById = new Map(
      users.map((user) => [
        user.unitId,
        {
          ...user,
          slug: slugByUserId.get(user.unitId) ?? null,
        },
      ]),
    );

    return {
      members: pageRows.map((row) => ({
        ...mapRealmMemberToDTO(row),
        user: mapPublicUser(userById.get(row.userId)),
      })),
      cursor:
        rows.length > limit
          ? pageRows[pageRows.length - 1]?.joinedAt.toISOString()
          : undefined,
      hasMore: rows.length > limit,
    };
  }

  /**
   * Remove the membership and the matching subscription in one
   * transaction. Idempotent for partial state — if either
   * row is missing the corresponding counter is not decremented, so a
   * second call doesn't double-decrement.
   * 在同一事务中移除成员关系及其对应的订阅。对部分状态幂等——若任一行
   * 缺失，则不递减对应计数器，因此重复调用不会重复递减。
   */
  async removeMember(
    realmUnitId: string,
    userId: string,
    options?: {
      moderation?: {
        actorUserId: string;
        reasonCode?: string;
        reasonText?: string | null;
        caseId?: string | null;
      };
    },
  ): Promise<void> {
    const db = await getServerDb();
    await db.transaction(async (tx) => {
      const [existingMember] = await tx
        .select({ realmUnitId: RealmMember.realmUnitId })
        .from(RealmMember)
        .where(
          and(
            eq(RealmMember.realmUnitId, realmUnitId),
            eq(RealmMember.userId, userId),
          ),
        )
        .limit(1);
      const [existingSub] = await tx
        .select({ id: Subscription.id })
        .from(Subscription)
        .where(
          and(
            eq(Subscription.subscriberUnitId, userId),
            eq(Subscription.subscribedUnitId, realmUnitId),
          ),
        )
        .limit(1);

      if (existingMember) {
        await tx
          .delete(RealmMember)
          .where(
            and(
              eq(RealmMember.realmUnitId, realmUnitId),
              eq(RealmMember.userId, userId),
            ),
          );
        if (options?.moderation) {
          await moderationActionService.appendModerationAction(tx, {
            authority: "REALM",
            realmUnitId,
            targetKind: "REALM_MEMBER",
            targetId: userId,
            actorKind: "USER",
            actorUserId: options.moderation.actorUserId,
            actionKind: "REMOVE_MEMBER",
            reasonCode: options.moderation.reasonCode ?? "realm.member.removed",
            reasonText: options.moderation.reasonText,
            caseId: options.moderation.caseId,
          });
        }
      }
      if (existingSub) {
        await tx
          .delete(Subscription)
          .where(eq(Subscription.id, existingSub.id));
        await tx
          .update(Unit)
          .set({
            subscriberCount: sql`${Unit.subscriberCount} - 1`,
            updatedAt: new Date(),
          })
          .where(eq(Unit.id, realmUnitId));
      }

      if (!existingMember) {
        const [realm] = await tx
          .select({ memberCount: Realm.memberCount })
          .from(Realm)
          .where(eq(Realm.unitId, realmUnitId))
          .limit(1);
        return realm?.memberCount ?? 0;
      }
      const [updatedRealm] = await tx
        .update(Realm)
        .set({
          memberCount: sql`${Realm.memberCount} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(Realm.unitId, realmUnitId))
        .returning({ memberCount: Realm.memberCount });
      if (!updatedRealm) throw new Error("Realm not found");
      return updatedRealm.memberCount;
    });

    await enqueueRealmSearch(
      SEARCH_COMMAND_KINDS.realmPatchMemberCount,
      realmUnitId,
    );
  }

  /**
   * Mute a realm — remove the Subscription row only (keeps RealmMember).
   * Idempotent for missing subscription. Muting preserves posting rights
   * and role, only suppresses inbound activity.
   * 静音某 realm——仅移除 Subscription 行（保留 RealmMember）。订阅缺失时
   * 幂等。静音保留发帖权限与角色，只抑制入站动态。
   */
  async muteRealm(realmUnitId: string, userId: string): Promise<void> {
    const db = await getServerDb();
    await db.transaction(async (tx) => {
      const [existingSub] = await tx
        .select({ id: Subscription.id })
        .from(Subscription)
        .where(
          and(
            eq(Subscription.subscriberUnitId, userId),
            eq(Subscription.subscribedUnitId, realmUnitId),
          ),
        )
        .limit(1);
      if (!existingSub) return;
      await tx.delete(Subscription).where(eq(Subscription.id, existingSub.id));
      await tx
        .update(Unit)
        .set({
          subscriberCount: sql`${Unit.subscriberCount} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(Unit.id, realmUnitId));
    });
  }

  /**
   * Unmute a realm — re-add the Subscription row with `channels=['*']`.
   * Idempotent: if a subscription already exists (caller wasn't muted),
   * no-op. The caller does not need to be a member to unmute, since
   * lurking subscriptions are also valid (in which case
   * "unmute" is just a generic subscribe).
   * 取消静音某 realm——以 `channels=['*']` 重新添加 Subscription 行。幂等：
   * 若订阅已存在（调用方未被静音），则为空操作。取消静音无需调用方是成员，
   * 因为潜水订阅同样有效（此时“取消静音”只是普通的订阅）。
   */
  async unmuteRealm(realmUnitId: string, userId: string): Promise<void> {
    const db = await getServerDb();
    await db.transaction(async (tx) => {
      const [existingSub] = await tx
        .select({ id: Subscription.id })
        .from(Subscription)
        .where(
          and(
            eq(Subscription.subscriberUnitId, userId),
            eq(Subscription.subscribedUnitId, realmUnitId),
          ),
        )
        .limit(1);
      if (existingSub) return;
      await tx.insert(Subscription).values({
        subscriberUnitId: userId,
        subscribedUnitId: realmUnitId,
        channels: ["*"],
        updatedAt: new Date(),
      });
      await tx
        .update(Unit)
        .set({
          subscriberCount: sql`${Unit.subscriberCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(Unit.id, realmUnitId));
    });
  }

  async getMember(
    realmUnitId: string,
    userId: string,
  ): Promise<RealmMemberDTO | null> {
    const db = await getServerDb();
    const [member] = await db
      .select()
      .from(RealmMember)
      .where(
        and(
          eq(RealmMember.realmUnitId, realmUnitId),
          eq(RealmMember.userId, userId),
        ),
      )
      .limit(1);
    if (!member) return null;

    const policyMembership =
      await governanceCapabilityService.realmMembershipForPolicy(
        realmUnitId,
        userId,
      );
    return mapRealmMemberToDTO(member, {
      capabilities: policyMembership?.capabilities ?? [],
    });
  }

  async getMembershipMe(
    realmUnitId: string,
    userId: string,
  ): Promise<RealmMembershipMeDTO> {
    const db = await getServerDb();
    const [member, realm, latestAcknowledgement] = await Promise.all([
      this.getMember(realmUnitId, userId),
      db
        .select({
          extra: Realm.extra,
          ruleVersion: Realm.ruleVersion,
          ruleRequireOnJoin: Realm.ruleRequireOnJoin,
          ruleRequireOnPost: Realm.ruleRequireOnPost,
          ruleRequireOnUpdate: Realm.ruleRequireOnUpdate,
        })
        .from(Realm)
        .where(eq(Realm.unitId, realmUnitId))
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

    const currentRuleUnitId = getRuleUnitIdFromExtra(realm?.extra ?? null);
    const requiredVersion = currentRuleUnitId
      ? (realm?.ruleVersion ?? null)
      : null;
    const requiresAcknowledgement = Boolean(
      currentRuleUnitId &&
        (realm?.ruleRequireOnJoin ||
          realm?.ruleRequireOnPost ||
          realm?.ruleRequireOnUpdate),
    );
    const acceptedCurrentRule = Boolean(
      currentRuleUnitId &&
        latestAcknowledgement?.ruleUnitId === currentRuleUnitId &&
        requiredVersion !== null &&
        latestAcknowledgement.version >= requiredVersion,
    );

    return {
      realmUnitId,
      userId,
      member,
      roleKey: member?.roleKey ?? null,
      state: member?.state ?? null,
      muted: member?.state === "muted",
      banned: member?.state === "banned",
      capabilities: member?.capabilities ?? [],
      ruleAcknowledgement: {
        currentRuleUnitId,
        requiredVersion,
        acceptedRuleUnitId: latestAcknowledgement?.ruleUnitId ?? null,
        acceptedVersion: latestAcknowledgement?.version ?? null,
        acceptedAt: latestAcknowledgement?.acceptedAt ?? null,
        acceptedLanguage: normalizedLanguage(
          latestAcknowledgement?.acceptedLanguage,
        ),
        acknowledgementRequired:
          requiresAcknowledgement && !acceptedCurrentRule,
      },
    };
  }

  // TODO(openspec-retired): an earlier spec intended NO per-user
  // rule-acknowledgement record, yet RealmRuleAcknowledgement exists and is
  // written here. Revisit whether the table should exist.
  // 早先的规范本不打算保留按用户的规则确认记录，但 RealmRuleAcknowledgement
  // 仍存在并在此处写入。需重新评估该表是否应当存在。
  async acknowledgeCurrentRule(
    realmUnitId: string,
    userId: string,
    input: AcknowledgeRealmRuleInput = {},
  ): Promise<RealmRuleAcknowledgementDTO> {
    const db = await getServerDb();
    const [realm] = await db
      .select({ extra: Realm.extra, ruleVersion: Realm.ruleVersion })
      .from(Realm)
      .where(eq(Realm.unitId, realmUnitId))
      .limit(1);
    const ruleUnitId = getRuleUnitIdFromExtra(realm?.extra ?? null);
    if (!realm || !ruleUnitId) {
      throw new Error("Realm does not have a current rule Unit");
    }

    const [row] = await db
      .insert(RealmRuleAcknowledgement)
      .values({
        realmUnitId,
        ruleUnitId,
        version: realm.ruleVersion,
        userId,
        acceptedLanguage: normalizedLanguage(input.acceptedLanguage),
      })
      .onConflictDoUpdate({
        target: [
          RealmRuleAcknowledgement.realmUnitId,
          RealmRuleAcknowledgement.ruleUnitId,
          RealmRuleAcknowledgement.version,
          RealmRuleAcknowledgement.userId,
        ],
        set: {
          acceptedAt: new Date(),
          acceptedLanguage: normalizedLanguage(input.acceptedLanguage),
        },
      })
      .returning();
    if (!row) throw new Error("Failed to acknowledge realm rule");

    return {
      realmUnitId: row.realmUnitId,
      ruleUnitId: row.ruleUnitId,
      version: row.version,
      userId: row.userId,
      acceptedAt: row.acceptedAt,
      acceptedLanguage: normalizedLanguage(row.acceptedLanguage),
    };
  }

  async getRulePolicy(realmUnitId: string): Promise<RealmRuleReferenceDTO> {
    const db = await getServerDb();
    const [row] = await db
      .select({
        unitId: Realm.unitId,
        extra: Realm.extra,
        ruleVersion: Realm.ruleVersion,
        ruleRequireOnJoin: Realm.ruleRequireOnJoin,
        ruleRequireOnPost: Realm.ruleRequireOnPost,
        ruleRequireOnUpdate: Realm.ruleRequireOnUpdate,
        rulePolicyUpdatedAt: Realm.rulePolicyUpdatedAt,
      })
      .from(Realm)
      .where(eq(Realm.unitId, realmUnitId))
      .limit(1);
    if (!row) {
      throw new Error("Realm not found");
    }

    const result = {
      realmUnitId: row.unitId,
      ruleUnitId: getRuleUnitIdFromExtra(row.extra),
      version: row.ruleVersion,
      requireOnJoin: row.ruleRequireOnJoin,
      requireOnPost: row.ruleRequireOnPost,
      requireOnUpdate: row.ruleRequireOnUpdate,
      updatedAt: row.rulePolicyUpdatedAt ?? undefined,
    };
    return result;
  }

  async resolveRule(
    realmUnitId: string,
    language?: string,
    languages: readonly string[] = [],
  ): Promise<RealmRuleResolvedDTO> {
    const policy = await this.getRulePolicy(realmUnitId);
    const requestedLanguage = normalizedLanguage(language ?? languages[0]);
    if (!policy.ruleUnitId) {
      return {
        ...policy,
        requestedLanguage,
        resolvedLanguage: null,
        translation: null,
        sourceRulePostUnitId: null,
        sourceRulePost: null,
      };
    }

    const db = await getServerDb();
    const [ruleUnit] = await db
      .select()
      .from(Unit)
      .where(eq(Unit.id, policy.ruleUnitId))
      .limit(1);
    if (!ruleUnit || ruleUnit.type !== "POST") {
      return {
        ...policy,
        requestedLanguage,
        resolvedLanguage: null,
        translation: null,
        sourceRulePostUnitId: null,
        sourceRulePost: null,
      };
    }

    const resolvedLanguage = resolveReadLanguage({
      explicitLanguage: language,
      languages,
      supportLanguages: await db
        .select()
        .from(UnitSupportLanguage)
        .where(eq(UnitSupportLanguage.unitId, ruleUnit.id)),
    });
    const translations = await db
      .select()
      .from(UnitTranslation)
      .where(eq(UnitTranslation.unitId, ruleUnit.id));
    const translation = resolvedLanguage
      ? translations.find((item) => item.language === resolvedLanguage)
      : undefined;
    const sourceRulePostUnitId = translation?.sourceUnitId ?? null;
    const sourceRulePost = sourceRulePostUnitId
      ? await postService.getByUnitId(sourceRulePostUnitId, {
          allowTombstone: true,
        })
      : null;

    return {
      ...policy,
      requestedLanguage,
      resolvedLanguage: normalizedLanguage(resolvedLanguage),
      translation: translation ? mapTranslationToDTO(translation) : null,
      sourceRulePostUnitId,
      sourceRulePost: sourceRulePost
        ? mapPostToDTO(
            sourceRulePost,
            undefined,
            [language, ...languages].filter((item): item is string => !!item),
          )
        : null,
    };
  }

  async updateRulePolicy(
    caller: RezicsSessionClaims,
    realmUnitId: string,
    input: UpdateRealmRulePolicyInput,
  ): Promise<RealmRuleReferenceDTO> {
    if (input.ruleUnitId !== undefined) {
      if (input.ruleUnitId) {
        await setSingleExtraKey(caller, realmUnitId, "rule", input.ruleUnitId);
      } else {
        await clearSingleExtraKey(caller, realmUnitId, "rule");
      }
    }

    const db = await getServerDb();
    const [row] = await db
      .update(Realm)
      .set({
        ruleVersion: input.version,
        ruleRequireOnJoin: input.requireOnJoin,
        ruleRequireOnPost: input.requireOnPost,
        ruleRequireOnUpdate: input.requireOnUpdate,
        rulePolicyUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(Realm.unitId, realmUnitId))
      .returning({
        unitId: Realm.unitId,
        extra: Realm.extra,
        ruleVersion: Realm.ruleVersion,
        ruleRequireOnJoin: Realm.ruleRequireOnJoin,
        ruleRequireOnPost: Realm.ruleRequireOnPost,
        ruleRequireOnUpdate: Realm.ruleRequireOnUpdate,
        rulePolicyUpdatedAt: Realm.rulePolicyUpdatedAt,
      });
    if (!row) throw new Error("Realm not found");

    await governanceAuditService.appendPrivilegedMutation({
      actorUserId: caller.userId,
      action: realmPolicyActions.rulesUpdate,
      targetKind: "realm-rules",
      targetId: realmUnitId,
      reason: "Realm rule policy update",
      correlationId: crypto.randomUUID(),
      metadata: {
        ruleUnitId: getRuleUnitIdFromExtra(row.extra),
        version: row.ruleVersion,
        requireOnJoin: row.ruleRequireOnJoin,
        requireOnPost: row.ruleRequireOnPost,
        requireOnUpdate: row.ruleRequireOnUpdate,
      },
    });

    const result = {
      realmUnitId: row.unitId,
      ruleUnitId: getRuleUnitIdFromExtra(row.extra),
      version: row.ruleVersion,
      requireOnJoin: row.ruleRequireOnJoin,
      requireOnPost: row.ruleRequireOnPost,
      requireOnUpdate: row.ruleRequireOnUpdate,
      updatedAt: row.rulePolicyUpdatedAt ?? undefined,
    };
    notifyRealmRuleUpdated({
      actorUserId: caller.userId,
      realmUnitId,
      ruleUnitId: result.ruleUnitId,
      version: result.version,
    });
    return result;
  }

  async readCommunityList(
    caller: RezicsSessionClaims | null,
    realmUnitId: string,
    key: RealmCommunityListKey,
  ): Promise<RealmExtraReadResponse> {
    return {
      realmId: realmUnitId,
      key,
      unitIds: await readListPublic(caller, realmUnitId, key),
    };
  }

  async readCommunityListAdmin(
    caller: RezicsSessionClaims,
    realmUnitId: string,
    key: RealmCommunityListKey,
  ): Promise<RealmExtraAdminReadResponse> {
    const { unitIds, staleIds } = await readListAdmin(caller, realmUnitId, key);
    return { realmId: realmUnitId, key, unitIds, staleIds };
  }

  async appendCommunityList(
    caller: RezicsSessionClaims,
    realmUnitId: string,
    key: RealmCommunityListKey,
    unitId: string,
  ): Promise<RealmExtraOkResponse> {
    const { unitIds } = await appendToList(caller, realmUnitId, key, unitId);
    await this.auditCommunityListMutation(caller, realmUnitId, key, "append", {
      unitId,
      unitIds,
    });
    return { ok: true, unitIds };
  }

  async reorderCommunityList(
    caller: RezicsSessionClaims,
    realmUnitId: string,
    key: RealmCommunityListKey,
    unitIds: string[],
  ): Promise<RealmExtraOkResponse> {
    const result = await reorderList(caller, realmUnitId, key, unitIds);
    await this.auditCommunityListMutation(caller, realmUnitId, key, "reorder", {
      unitIds: result.unitIds,
    });
    return { ok: true, unitIds: result.unitIds };
  }

  async removeCommunityListEntry(
    caller: RezicsSessionClaims,
    realmUnitId: string,
    key: RealmCommunityListKey,
    unitId: string,
  ): Promise<RealmExtraOkResponse> {
    const { unitIds } = await removeFromList(caller, realmUnitId, key, unitId);
    await this.auditCommunityListMutation(caller, realmUnitId, key, "remove", {
      unitId,
      unitIds,
    });
    return { ok: true, unitIds };
  }

  private auditCommunityListMutation(
    caller: RezicsSessionClaims,
    realmUnitId: string,
    key: RealmCommunityListKey,
    operation: "append" | "reorder" | "remove",
    metadata: Record<string, unknown>,
  ) {
    return governanceAuditService.appendPrivilegedMutation({
      actorUserId: caller.userId,
      action: realmPolicyActions.contentPin,
      targetKind: communityListTargetKind(key),
      targetId: realmUnitId,
      reason: `Realm ${key} ${operation}`,
      correlationId: crypto.randomUUID(),
      metadata: { key, operation, ...metadata },
    });
  }

  // --- Content feed ---
  // --- 内容流 ---

  async addUnitRealm(
    realmUnitId: string,
    unitId: string,
    input: Pick<AddUnitRealmInput, "moderationStatus" | "isLocked"> = {},
  ): Promise<UnitRealmDTO> {
    const db = await getServerDb();
    const [row] = await db
      .insert(UnitRealm)
      .values({
        realmUnitId,
        unitId,
        moderationStatus: input.moderationStatus?.toUpperCase() as any,
        isLocked: input.isLocked,
      })
      .returning();
    if (!row) throw new Error("Failed to add unit to realm");
    await Promise.all([
      enqueueContentSearch(SEARCH_COMMAND_KINDS.contentPatchRealmIds, unitId),
      this.patchPostRealmIds(unitId),
    ]);
    return mapUnitRealmToDTO(row);
  }

  async removeUnitRealm(realmUnitId: string, unitId: string): Promise<void> {
    const db = await getServerDb();
    await db
      .delete(UnitRealm)
      .where(
        and(
          eq(UnitRealm.realmUnitId, realmUnitId),
          eq(UnitRealm.unitId, unitId),
        ),
      );
    await Promise.all([
      enqueueContentSearch(SEARCH_COMMAND_KINDS.contentPatchRealmIds, unitId),
      this.patchPostRealmIds(unitId),
    ]);
  }

  // --- Realm tag applications ---
  // --- Realm 标签应用 ---
  //
  // RealmTagApplication and UnitTag remain independent score layers. The standard
  // RealmTagApplication write path contributes the caller's global TagVote once, but
  // later RealmTagApplication deletion never deletes or decrements UnitTag.
  // RealmTagApplication 与 UnitTag 仍是相互独立的分数层。标准的
  // RealmTagApplication 写入路径只贡献调用方的全局 TagVote 一次，但后续删除
  // RealmTagApplication 时绝不会删除或递减 UnitTag。

  /**
   * Create a RealmTagApplication with creation-as-vote semantics.
   *
   * The caller MUST be a member of the realm; the route enforces the
   * membership check and passes through the actor's userId.
   * Realms apply existing global tags only: `realmUnitId` must be REALM and
   * `tagUnitId` must be TAG. This does not mint a realm-local tag and does not
   * require UnitRealm(realmUnitId, unitId).
   *
   * - First call: writes the RealmTagApplication (score=1, voteCount=1) and a +1
   *   RealmTagApplicationVote.
   * - Subsequent distinct-member calls: insert a RealmTagApplicationVote and recompute.
   * - Idempotent for the same user: existing RealmTagApplicationVote left untouched.
   * - The caller's global TagVote(userId, unitId, tagUnitId, +1) is created
   *   once or preserved, then UnitTag aggregates are recomputed.
   *
   * 创建 RealmTagApplication，采用“创建即投票”的语义。
   *
   * 调用方必须是该 realm 的成员；路由负责强制成员检查并透传操作者的 userId。
   * realm 只应用已有的全局标签：`realmUnitId` 必须是 REALM，`tagUnitId` 必须是
   * TAG。此操作不会铸造 realm 本地标签，也不要求存在
   * UnitRealm(realmUnitId, unitId)。
   *
   * - 首次调用：写入 RealmTagApplication（score=1、voteCount=1）以及一条 +1 的
   *   RealmTagApplicationVote。
   * - 后续来自不同成员的调用：插入一条 RealmTagApplicationVote 并重新计算。
   * - 对同一用户幂等：已有的 RealmTagApplicationVote 保持不变。
   * - 调用方的全局 TagVote(userId, unitId, tagUnitId, +1) 会被创建一次或保留，
   *   随后重新计算 UnitTag 聚合值。
   */
  async createRealmTagApplication(
    userId: string,
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<RealmTagApplicationRow> {
    const db = await getServerDb();
    const row = await db.transaction(async (tx) => {
      await this.assertRealmAndTagTypes(realmUnitId, tagUnitId, tx);

      await tx
        .insert(RealmTagApplicationTable)
        .values({
          realmUnitId,
          tagUnitId,
          unitId,
          score: 0,
          voteCount: 0,
          updatedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [
            RealmTagApplicationTable.realmUnitId,
            RealmTagApplicationTable.tagUnitId,
            RealmTagApplicationTable.unitId,
          ],
        });

      const [existing] = await tx
        .select({ userId: RealmTagApplicationVote.userId })
        .from(RealmTagApplicationVote)
        .where(
          and(
            eq(RealmTagApplicationVote.realmUnitId, realmUnitId),
            eq(RealmTagApplicationVote.tagUnitId, tagUnitId),
            eq(RealmTagApplicationVote.unitId, unitId),
            eq(RealmTagApplicationVote.userId, userId),
          ),
        )
        .limit(1);

      if (!existing) {
        await tx.insert(RealmTagApplicationVote).values({
          realmUnitId,
          userId,
          unitId,
          tagUnitId,
          value: 1,
        });
      }

      const [agg] = await tx
        .select({
          score: sql<number>`coalesce(sum(${RealmTagApplicationVote.value}), 0)::int`,
          voteCount: count(RealmTagApplicationVote.value),
        })
        .from(RealmTagApplicationVote)
        .where(
          and(
            eq(RealmTagApplicationVote.realmUnitId, realmUnitId),
            eq(RealmTagApplicationVote.unitId, unitId),
            eq(RealmTagApplicationVote.tagUnitId, tagUnitId),
          ),
        );

      const [realmTagApplication] = await tx
        .update(RealmTagApplicationTable)
        .set({
          score: agg?.score ?? 0,
          voteCount: agg?.voteCount ?? 0,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(RealmTagApplicationTable.realmUnitId, realmUnitId),
            eq(RealmTagApplicationTable.tagUnitId, tagUnitId),
            eq(RealmTagApplicationTable.unitId, unitId),
          ),
        )
        .returning();
      if (!realmTagApplication) {
        throw new Error("RealmTagApplication not found");
      }

      const [globalVote] = await tx
        .select({ userId: TagVote.userId })
        .from(TagVote)
        .where(
          and(
            eq(TagVote.userId, userId),
            eq(TagVote.unitId, unitId),
            eq(TagVote.tagUnitId, tagUnitId),
          ),
        )
        .limit(1);

      if (!globalVote) {
        await tx.insert(TagVote).values({
          userId,
          unitId,
          tagUnitId,
          value: 1,
        });
      }

      const [globalAgg] = await tx
        .select({
          score: sql<number>`coalesce(sum(${TagVote.value}), 0)::int`,
          voteCount: count(TagVote.value),
        })
        .from(TagVote)
        .where(
          and(eq(TagVote.unitId, unitId), eq(TagVote.tagUnitId, tagUnitId)),
        );

      const unitTagValues = {
        unitId,
        tagUnitId,
        score: globalAgg?.score ?? 0,
        voteCount: globalAgg?.voteCount ?? 0,
        updatedAt: new Date(),
      };
      await tx
        .insert(UnitTag)
        .values(unitTagValues)
        .onConflictDoUpdate({
          target: [UnitTag.unitId, UnitTag.tagUnitId],
          set: {
            score: unitTagValues.score,
            voteCount: unitTagValues.voteCount,
            updatedAt: unitTagValues.updatedAt,
          },
        });

      return realmTagApplication;
    });

    await Promise.all([
      enqueueContentSearch(SEARCH_COMMAND_KINDS.contentPatchTags, unitId),
      enqueueContentSearch(
        SEARCH_COMMAND_KINDS.contentPatchRealmTagKeys,
        unitId,
      ),
    ]);
    return row;
  }

  /**
   * Set pin/position on a RealmTagApplication. The route enforces admin OR
   * `Realm.owner` authorization.
   * 设置 RealmTagApplication 的置顶/位置。路由负责强制 admin 或
   * `Realm.owner` 授权。
   */
  async setRealmTagApplicationPin(
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
    input: { pinned?: boolean; position?: string | null },
  ): Promise<RealmTagApplicationRow> {
    const data: { pinned?: boolean; position?: string | null } = {};
    if (input.pinned !== undefined) {
      data.pinned = input.pinned;
      if (input.pinned === false) data.position = null;
    }
    if (input.position !== undefined) data.position = input.position;

    const db = await getServerDb();
    const [updated] = await db
      .update(RealmTagApplicationTable)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(RealmTagApplicationTable.realmUnitId, realmUnitId),
          eq(RealmTagApplicationTable.unitId, unitId),
          eq(RealmTagApplicationTable.tagUnitId, tagUnitId),
        ),
      )
      .returning();
    if (!updated) throw new Error("RealmTagApplication not found");
    await enqueueContentSearch(
      SEARCH_COMMAND_KINDS.contentPatchRealmTagKeys,
      unitId,
    );
    return updated;
  }
  /**
   * Delete a RealmTagApplication and the underlying RealmTagApplicationVote rows for that triple.
   * Does NOT cascade to UnitTag.
   * 删除某 RealmTagApplication 及该三元组下层的 RealmTagApplicationVote 行。
   * 不会级联到 UnitTag。
   */
  async deleteRealmTagApplication(
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<void> {
    const db = await getServerDb();
    await db
      .delete(RealmTagApplicationTable)
      .where(
        and(
          eq(RealmTagApplicationTable.realmUnitId, realmUnitId),
          eq(RealmTagApplicationTable.unitId, unitId),
          eq(RealmTagApplicationTable.tagUnitId, tagUnitId),
        ),
      );
    await enqueueContentSearch(
      SEARCH_COMMAND_KINDS.contentPatchRealmTagKeys,
      unitId,
    );
  }

  /**
   * Cast a RealmTagApplicationVote upsert and recompute the parent RealmTagApplication's
   * `score` and `voteCount`. Membership check is enforced by the route at
   * write time; votes are retained even if the member later leaves.
   * upsert 一条 RealmTagApplicationVote，并重新计算父级 RealmTagApplication 的
   * `score` 与 `voteCount`。成员检查由路由在写入时强制执行；即使成员之后退出，
   * 票数仍会保留。
   */
  async castRealmTagApplicationVote(
    userId: string,
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
    value: number,
  ): Promise<void> {
    const clamped = value > 0 ? 1 : -1;

    const db = await getServerDb();
    await db.transaction(async (tx) => {
      await tx
        .insert(RealmTagApplicationVote)
        .values({ realmUnitId, userId, unitId, tagUnitId, value: clamped })
        .onConflictDoUpdate({
          target: [
            RealmTagApplicationVote.realmUnitId,
            RealmTagApplicationVote.tagUnitId,
            RealmTagApplicationVote.unitId,
            RealmTagApplicationVote.userId,
          ],
          set: { value: clamped },
        });

      const [agg] = await tx
        .select({
          score: sql<number>`coalesce(sum(${RealmTagApplicationVote.value}), 0)::int`,
          voteCount: count(RealmTagApplicationVote.value),
        })
        .from(RealmTagApplicationVote)
        .where(
          and(
            eq(RealmTagApplicationVote.realmUnitId, realmUnitId),
            eq(RealmTagApplicationVote.unitId, unitId),
            eq(RealmTagApplicationVote.tagUnitId, tagUnitId),
          ),
        );

      await tx
        .update(RealmTagApplicationTable)
        .set({
          score: agg?.score ?? 0,
          voteCount: agg?.voteCount ?? 0,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(RealmTagApplicationTable.realmUnitId, realmUnitId),
            eq(RealmTagApplicationTable.tagUnitId, tagUnitId),
            eq(RealmTagApplicationTable.unitId, unitId),
          ),
        );
    });

    await enqueueContentSearch(
      SEARCH_COMMAND_KINDS.contentPatchRealmTagKeys,
      unitId,
    );
  }

  /**
   * List RealmTagApplication rows for a given (realm, unit), ordered pin-first
   * then score-desc. Regular callers do not see rows below the visibility
   * threshold; privileged callers (admin / realm owner) see them so the
   * route can flag them.
   * 列出给定 (realm, unit) 的 RealmTagApplication 行，先按置顶、再按分数降序
   * 排序。普通调用方看不到低于可见性阈值的行；特权调用方（admin / realm
   * owner）可看到，以便路由对其作标记。
   */
  async listRealmTagsForUnit(
    realmUnitId: string,
    unitId: string,
    options?: { includeBelowThreshold?: boolean },
  ): Promise<RealmTagApplicationRow[]> {
    const db = await getServerDb();
    return db
      .select()
      .from(RealmTagApplicationTable)
      .where(
        and(
          eq(RealmTagApplicationTable.realmUnitId, realmUnitId),
          eq(RealmTagApplicationTable.unitId, unitId),
          options?.includeBelowThreshold
            ? undefined
            : gt(
                RealmTagApplicationTable.score,
                REALM_TAG_VISIBILITY_THRESHOLD,
              ),
        ),
      )
      .orderBy(
        desc(RealmTagApplicationTable.pinned),
        asc(RealmTagApplicationTable.position),
        desc(RealmTagApplicationTable.score),
        asc(RealmTagApplicationTable.tagUnitId),
      );
  }

  /**
   * Admin-only discovery: list RealmTagApplication rows at or below the given
   * score threshold, optionally constrained to a single realm. Ordered
   * ascending so the worst offenders surface first.
   * 仅限 admin 的发现接口：列出分数低于或等于给定阈值的 RealmTagApplication
   * 行，可选地限定在单个 realm 内。按升序排序，使问题最严重的行最先出现。
   */
  async listLowScoreRealmTagApplications(
    threshold: number,
    limit: number,
    realmUnitId?: string,
  ): Promise<RealmTagApplicationRow[]> {
    const db = await getServerDb();
    return db
      .select()
      .from(RealmTagApplicationTable)
      .where(
        and(
          lte(RealmTagApplicationTable.score, threshold),
          realmUnitId
            ? eq(RealmTagApplicationTable.realmUnitId, realmUnitId)
            : undefined,
        ),
      )
      .orderBy(
        asc(RealmTagApplicationTable.score),
        asc(RealmTagApplicationTable.realmUnitId),
        asc(RealmTagApplicationTable.unitId),
        asc(RealmTagApplicationTable.tagUnitId),
      )
      .limit(Math.max(1, Math.min(limit, 200)));
  }

  async listByMember(
    userId: string,
    options: {
      publicOnly?: boolean;
      languageMode?: ListLanguageMode | null;
    } & EffectiveReadLanguageInput = {},
  ): Promise<{ realms: RealmDTO[]; total: number }> {
    const db = await getServerDb();
    const members = await db
      .select({ realmUnitId: RealmMember.realmUnitId })
      .from(RealmMember)
      .where(eq(RealmMember.userId, userId));

    const realmIds = members.map((m) => m.realmUnitId);
    if (realmIds.length === 0) return { realms: [], total: 0 };

    const where = and(
      inArray(Realm.unitId, realmIds),
      options.publicOnly ? eq(Realm.isPublic, true) : undefined,
    );
    const [realms, totalRows] = await Promise.all([
      db
        .select({ unitId: Realm.unitId })
        .from(Realm)
        .innerJoin(Unit, eq(Realm.unitId, Unit.id))
        .where(where)
        .orderBy(desc(Unit.createdAt)),
      db.select({ total: count() }).from(Realm).where(where),
    ]);

    const hydratedRealms = await hydrateUnitOwnerUserSlugs(
      await Promise.all(
        realms.map((realm) => hydrateRealmWithRelations(realm.unitId)),
      ),
    );
    return {
      realms: await Promise.all(
        hydratedRealms.map(async (r) => {
          const dto = mapRealmToDTO(r, options);
          return {
            ...dto,
            extra: await filterRealmExtraPublic(dto.extra),
          };
        }),
      ),
      total: totalRows[0]?.total ?? 0,
    };
  }
}

export const realmService = new RealmService();
