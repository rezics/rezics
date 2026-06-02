import type {
  AcknowledgeRealmRuleInput,
  CreateRealmInput,
  RealmDTO,
  RealmExtraAdminReadResponse,
  RealmExtraOkResponse,
  RealmExtraReadResponse,
  RealmListQuery,
  RealmMemberListQuery,
  RealmMemberListResponse,
  RealmMemberDTO,
  RealmMembershipMeDTO,
  RealmRuleAcknowledgementDTO,
  RealmRuleReferenceDTO,
  RealmRuleResolvedDTO,
  RezicsSessionClaims,
  UnitRealmDTO,
  UpdateRealmRulePolicyInput,
  UpdateRealmInput,
} from "@rezics/contract";
import { parseIdsCsv, validateSlug } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import type { Prisma, RealmTagApplication } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { nullableContentDocJson } from "@/content-doc/prisma-json";
import { governanceAuditService } from "@/governance/audit.service";
import { governanceCapabilityService } from "@/governance/capability.service";
import { realmPolicyActions } from "@/governance/action/realm";
import { serverJobProducer } from "@/job/job-boundary";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
import { mapPostToDTO } from "@/post/post.mapper";
import { postInclude } from "@/post/types";
import { mapTranslationToDTO } from "@/unit/mapper";
import { translationService } from "@/unit/translation.service";

/** Score at or below this threshold hides a RealmTagApplication from regular users. */
export const REALM_TAG_VISIBILITY_THRESHOLD = -100;

import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
  loadUserSlugMap,
} from "@/utils/userSlugHydration";
import { mapPublicUser, publicUserSelect } from "@/utils/sanitizeUser";
import {
  mapRealmListRowToDTO,
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
import {
  type RealmWithRelations,
  realmInclude,
  realmListSelect,
} from "./types";

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

function getRuleUnitIdFromExtra(extra: Prisma.JsonValue | null): string | null {
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
    const recipients = await prisma.realmMember.findMany({
      where: {
        realmUnitId: input.realmUnitId,
        state: "ACTIVE",
        roleKey: { in: [...REALM_JOIN_APPROVAL_ROLES] },
        NOT: { userId: input.requesterUserId },
      },
      select: { userId: true },
    });
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
    tx: Pick<typeof prisma, "unit"> = prisma,
  ): Promise<void> {
    const [realm, tag] = await Promise.all([
      tx.unit.findUnique({
        where: { id: realmUnitId },
        select: { id: true, type: true, realm: { select: { unitId: true } } },
      }),
      tx.unit.findUnique({
        where: { id: tagUnitId },
        select: { id: true, type: true },
      }),
    ]);

    if (!realm || realm.type !== UnitType.REALM || !realm.realm) {
      throw new Error("realmUnitId must reference an existing REALM Unit");
    }
    if (!tag || tag.type !== UnitType.TAG) {
      throw new Error("tagUnitId must reference an existing TAG Unit");
    }
  }

  private async patchPostRealmIds(unitId: string): Promise<void> {
    await enqueuePostSync(unitId);
  }

  private buildWhere(options: RealmListQuery): Prisma.RealmWhereInput {
    const and: Prisma.RealmWhereInput[] = [
      { unit: { status: UnitStatus.PUBLISHED, type: UnitType.REALM } },
    ];

    if (options.userId?.trim()) {
      and.push({ unit: { userId: options.userId } });
    }

    if (options.isPublic !== undefined) {
      and.push({ isPublic: options.isPublic });
    }

    if (options.isOfficial !== undefined) {
      and.push({ isOfficial: options.isOfficial });
    }

    const idList = parseIdsCsv(options.ids);
    if (idList && idList.length > 0) {
      and.push({ unitId: { in: idList } });
    }

    return and.length ? { AND: and } : {};
  }

  private buildOrderBy(
    options: RealmListQuery,
  ): Prisma.Enumerable<Prisma.RealmOrderByWithRelationInput> {
    const order = (options.sort?.order ?? "desc") as "asc" | "desc";
    const field = options.sort?.field ?? "createdAt";
    if (field === "memberCount")
      return [{ memberCount: order }, { unitId: "desc" }];
    if (field === "updatedAt")
      return [{ unit: { updatedAt: order } }, { unitId: "desc" }];
    return [{ unit: { createdAt: order } }, { unitId: "desc" }];
  }

  // --- Realm CRUD ---

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
    const where = this.buildWhere(options);
    const orderBy = this.buildOrderBy(options);

    const [rows, total] = await Promise.all([
      prisma.realm.findMany({
        where,
        orderBy,
        skip: skipNum,
        take: limitNum,
        select: realmListSelect,
      }),
      prisma.realm.count({ where }),
    ]);

    const hydratedRows = await hydrateUnitOwnerUserSlugs(rows);
    return {
      realms: await Promise.all(
        hydratedRows.map(async (row) => {
          const dto = mapRealmListRowToDTO(row);
          return {
            ...dto,
            extra: await filterRealmExtraPublic(dto.extra),
          };
        }),
      ),
      total,
    };
  }

  async getByUnitId(
    unitId: string,
    viewerUserId?: string | null,
  ): Promise<RealmDTO> {
    const row = await prisma.realm.findFirstOrThrow({
      where: { unitId },
      include: realmInclude,
    });
    const dto = mapRealmToDTO(await hydrateUnitOwnerUserSlugRow(row));
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
    const { isPublic, extra, translations } = req;

    let normalizedSlug: string | undefined;
    if (req.slug) {
      const validation = validateSlug(req.slug);
      if (!validation.ok) throw new Error(`Invalid slug: ${validation.reason}`);
      normalizedSlug = validation.normalized;
    }

    const { requireSlugScopeId } = await import("@/infra/slug-scopes");
    const realmScope = requireSlugScopeId("realm");
    const unit = await prisma.unit.create({
      data: {
        userId,
        slugScope: realmScope,
        type: UnitType.REALM,
        status: UnitStatus.PUBLISHED,
        ...(normalizedSlug ? { slug: normalizedSlug } : {}),
        ...(translations?.length
          ? {
              translations: {
                create: translations.map((tr) => ({
                  language: tr.language,
                  title: tr.title,
                  subtitle: tr.subtitle,
                  summary: tr.summary,
                  description: nullableContentDocJson(tr.description),
                })),
              },
            }
          : {}),
      },
    });

    const row = await prisma.realm.create({
      data: {
        unitId: unit.id,
        isPublic: isPublic ?? true,
        extra: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
        memberCount: 1,
        members: {
          create: {
            userId,
            roleKey: "owner",
          },
        },
      },
      include: realmInclude,
    });

    await enqueueRealmSearch(SEARCH_COMMAND_KINDS.realmSync, unit.id);

    const dto = mapRealmToDTO(await hydrateUnitOwnerUserSlugRow(row));
    return {
      ...dto,
      extra: await filterRealmExtraPublic(dto.extra),
    };
  }

  async update(unitId: string, req: UpdateRealmInput): Promise<RealmDTO> {
    const { isPublic, isOfficial, extra } = req;

    const row = await prisma.realm.update({
      where: { unitId },
      data: {
        isPublic: isPublic !== undefined ? isPublic : undefined,
        isOfficial: isOfficial !== undefined ? isOfficial : undefined,
        extra:
          extra !== undefined
            ? ((extra ?? undefined) as Prisma.InputJsonValue | undefined)
            : undefined,
      },
      include: realmInclude,
    });

    const patchFields: Record<string, any> = {};
    if (isPublic !== undefined) patchFields.isPublic = isPublic;
    if (isOfficial !== undefined) patchFields.isOfficial = isOfficial;
    if (extra !== undefined) patchFields.extra = extra;
    await enqueueRealmMetadata(unitId, patchFields);

    const dto = mapRealmToDTO(await hydrateUnitOwnerUserSlugRow(row));
    return {
      ...dto,
      extra: await filterRealmExtraPublic(dto.extra),
    };
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
  }

  // --- Membership ---

  /**
   * Join the realm as a member. Atomically writes BOTH the `RealmMember`
   * permission edge AND the `Subscription` attention edge (channels=['*']).
   * Bumps both denormalized
   * counters (`Realm.memberCount` and `Unit.subscriberCount`) in the same
   * transaction. If a Subscription row already exists (the user was
   * lurking on a public realm and is now joining), the upsert keeps it
   * intact and the subscriberCount stays accurate.
   */
  async joinRealm(
    realmUnitId: string,
    userId: string,
    roleKey?: string,
  ): Promise<RealmMemberDTO> {
    const { member } = await prisma.$transaction(async (tx) => {
      const realmPolicy = await tx.realm.findUnique({
        where: { unitId: realmUnitId },
        select: {
          extra: true,
          ruleVersion: true,
          ruleRequireOnJoin: true,
          joinRequiresApproval: true,
        },
      });
      const ruleUnitId = getRuleUnitIdFromExtra(realmPolicy?.extra ?? null);
      if (realmPolicy?.ruleRequireOnJoin && ruleUnitId) {
        const acknowledgement = await tx.realmRuleAcknowledgement.findUnique({
          where: {
            realmUnitId_ruleUnitId_version_userId: {
              realmUnitId,
              ruleUnitId,
              version: realmPolicy.ruleVersion,
              userId,
            },
          },
          select: { realmUnitId: true },
        });
        if (!acknowledgement) {
          throw new Error("Realm rules must be acknowledged before joining");
        }
      }

      const member = await tx.realmMember.create({
        data: {
          realmUnitId,
          userId,
          roleKey: roleKey ?? "member",
          state: realmPolicy?.joinRequiresApproval ? "PENDING" : "ACTIVE",
          onboardingCompletedAt: realmPolicy?.joinRequiresApproval
            ? null
            : new Date(),
        },
      });

      const updatedRealm = await tx.realm.update({
        where: { unitId: realmUnitId },
        data: { memberCount: { increment: 1 } },
      });

      const existingSub = await tx.subscription.findUnique({
        where: {
          subscriberUnitId_subscribedUnitId: {
            subscriberUnitId: userId,
            subscribedUnitId: realmUnitId,
          },
        },
        select: { id: true },
      });
      if (!existingSub) {
        await tx.subscription.create({
          data: {
            subscriberUnitId: userId,
            subscribedUnitId: realmUnitId,
            channels: ["*"],
          },
        });
        await tx.unit.update({
          where: { id: realmUnitId },
          data: { subscriberCount: { increment: 1 } },
        });
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
    const member = await prisma.realmMember.update({
      where: {
        realmUnitId_userId: { realmUnitId, userId },
      },
      data: { roleKey },
    });

    return mapRealmMemberToDTO(member);
  }

  async listMembers(
    realmUnitId: string,
    options: RealmMemberListQuery = {},
  ): Promise<RealmMemberListResponse> {
    const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 100));
    const cursorDate = options.cursor ? new Date(options.cursor) : null;
    const rows = await prisma.realmMember.findMany({
      where: {
        realmUnitId,
        ...(cursorDate && !Number.isNaN(cursorDate.getTime())
          ? { joinedAt: { lt: cursorDate } }
          : {}),
      },
      orderBy: [{ joinedAt: "desc" }, { userId: "asc" }],
      take: limit + 1,
    });
    const pageRows = rows.slice(0, limit);
    const users = await prisma.user.findMany({
      where: { unitId: { in: pageRows.map((row) => row.userId) } },
      select: publicUserSelect,
    });
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
   */
  async removeMember(realmUnitId: string, userId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existingMember = await tx.realmMember.findUnique({
        where: { realmUnitId_userId: { realmUnitId, userId } },
        select: { realmUnitId: true },
      });
      const existingSub = await tx.subscription.findUnique({
        where: {
          subscriberUnitId_subscribedUnitId: {
            subscriberUnitId: userId,
            subscribedUnitId: realmUnitId,
          },
        },
        select: { id: true },
      });

      if (existingMember) {
        await tx.realmMember.delete({
          where: { realmUnitId_userId: { realmUnitId, userId } },
        });
      }
      if (existingSub) {
        await tx.subscription.delete({ where: { id: existingSub.id } });
        await tx.unit.update({
          where: { id: realmUnitId },
          data: { subscriberCount: { decrement: 1 } },
        });
      }

      if (!existingMember) {
        const realm = await tx.realm.findUnique({
          where: { unitId: realmUnitId },
          select: { memberCount: true },
        });
        return realm?.memberCount ?? 0;
      }
      const updatedRealm = await tx.realm.update({
        where: { unitId: realmUnitId },
        data: { memberCount: { decrement: 1 } },
      });
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
   */
  async muteRealm(realmUnitId: string, userId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existingSub = await tx.subscription.findUnique({
        where: {
          subscriberUnitId_subscribedUnitId: {
            subscriberUnitId: userId,
            subscribedUnitId: realmUnitId,
          },
        },
        select: { id: true },
      });
      if (!existingSub) return;
      await tx.subscription.delete({ where: { id: existingSub.id } });
      await tx.unit.update({
        where: { id: realmUnitId },
        data: { subscriberCount: { decrement: 1 } },
      });
    });
  }

  /**
   * Unmute a realm — re-add the Subscription row with `channels=['*']`.
   * Idempotent: if a subscription already exists (caller wasn't muted),
   * no-op. The caller does not need to be a member to unmute, since
   * lurking subscriptions are also valid (in which case
   * "unmute" is just a generic subscribe).
   */
  async unmuteRealm(realmUnitId: string, userId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existingSub = await tx.subscription.findUnique({
        where: {
          subscriberUnitId_subscribedUnitId: {
            subscriberUnitId: userId,
            subscribedUnitId: realmUnitId,
          },
        },
        select: { id: true },
      });
      if (existingSub) return;
      await tx.subscription.create({
        data: {
          subscriberUnitId: userId,
          subscribedUnitId: realmUnitId,
          channels: ["*"],
        },
      });
      await tx.unit.update({
        where: { id: realmUnitId },
        data: { subscriberCount: { increment: 1 } },
      });
    });
  }

  async getMember(
    realmUnitId: string,
    userId: string,
  ): Promise<RealmMemberDTO | null> {
    const member = await prisma.realmMember.findUnique({
      where: {
        realmUnitId_userId: { realmUnitId, userId },
      },
    });
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
    const [member, realm, latestAcknowledgement] = await Promise.all([
      this.getMember(realmUnitId, userId),
      prisma.realm.findUnique({
        where: { unitId: realmUnitId },
        select: {
          extra: true,
          ruleVersion: true,
          ruleRequireOnJoin: true,
          ruleRequireOnPost: true,
          ruleRequireOnUpdate: true,
        },
      }),
      prisma.realmRuleAcknowledgement.findFirst({
        where: { realmUnitId, userId },
        orderBy: [{ acceptedAt: "desc" }, { version: "desc" }],
      }),
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
        acceptedLanguage: latestAcknowledgement?.acceptedLanguage ?? null,
        acknowledgementRequired:
          requiresAcknowledgement && !acceptedCurrentRule,
      },
    };
  }

  // TODO(openspec-retired): an earlier spec intended NO per-user
  // rule-acknowledgement record, yet RealmRuleAcknowledgement exists and is
  // written here. Revisit whether the table should exist.
  async acknowledgeCurrentRule(
    realmUnitId: string,
    userId: string,
    input: AcknowledgeRealmRuleInput = {},
  ): Promise<RealmRuleAcknowledgementDTO> {
    const realm = await prisma.realm.findUnique({
      where: { unitId: realmUnitId },
      select: { extra: true, ruleVersion: true },
    });
    const ruleUnitId = getRuleUnitIdFromExtra(realm?.extra ?? null);
    if (!realm || !ruleUnitId) {
      throw new Error("Realm does not have a current rule Unit");
    }

    const row = await prisma.realmRuleAcknowledgement.upsert({
      where: {
        realmUnitId_ruleUnitId_version_userId: {
          realmUnitId,
          ruleUnitId,
          version: realm.ruleVersion,
          userId,
        },
      },
      create: {
        realmUnitId,
        ruleUnitId,
        version: realm.ruleVersion,
        userId,
        acceptedLanguage: input.acceptedLanguage ?? null,
      },
      update: {
        acceptedAt: new Date(),
        acceptedLanguage: input.acceptedLanguage ?? null,
      },
    });

    return {
      realmUnitId: row.realmUnitId,
      ruleUnitId: row.ruleUnitId,
      version: row.version,
      userId: row.userId,
      acceptedAt: row.acceptedAt,
      acceptedLanguage: row.acceptedLanguage,
    };
  }

  async getRulePolicy(realmUnitId: string): Promise<RealmRuleReferenceDTO> {
    const row = await prisma.realm.findUnique({
      where: { unitId: realmUnitId },
      select: {
        unitId: true,
        extra: true,
        ruleVersion: true,
        ruleRequireOnJoin: true,
        ruleRequireOnPost: true,
        ruleRequireOnUpdate: true,
        rulePolicyUpdatedAt: true,
      },
    });
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
  ): Promise<RealmRuleResolvedDTO> {
    const policy = await this.getRulePolicy(realmUnitId);
    if (!policy.ruleUnitId) {
      return {
        ...policy,
        requestedLanguage: language ?? null,
        resolvedLanguage: null,
        translation: null,
        sourceRulePostUnitId: null,
        sourceRulePost: null,
      };
    }

    const ruleUnit = await prisma.unit.findUnique({
      where: { id: policy.ruleUnitId },
      select: { id: true, type: true, defaultLanguage: true },
    });
    if (!ruleUnit || ruleUnit.type !== UnitType.POST) {
      return {
        ...policy,
        requestedLanguage: language ?? null,
        resolvedLanguage: null,
        translation: null,
        sourceRulePostUnitId: null,
        sourceRulePost: null,
      };
    }

    const translation = await translationService.resolveTranslation(
      policy.ruleUnitId,
      language,
      ruleUnit.defaultLanguage ?? undefined,
    );
    const sourceRulePostUnitId = translation?.sourceUnitId ?? null;
    const sourceRulePost = sourceRulePostUnitId
      ? await prisma.post.findUnique({
          where: { unitId: sourceRulePostUnitId },
          include: postInclude,
        })
      : null;

    return {
      ...policy,
      requestedLanguage: language ?? null,
      resolvedLanguage: translation?.language ?? null,
      translation: translation ? mapTranslationToDTO(translation) : null,
      sourceRulePostUnitId,
      sourceRulePost: sourceRulePost ? mapPostToDTO(sourceRulePost) : null,
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

    const row = await prisma.realm.update({
      where: { unitId: realmUnitId },
      data: {
        ruleVersion: input.version,
        ruleRequireOnJoin: input.requireOnJoin,
        ruleRequireOnPost: input.requireOnPost,
        ruleRequireOnUpdate: input.requireOnUpdate,
        rulePolicyUpdatedAt: new Date(),
      },
      select: {
        unitId: true,
        extra: true,
        ruleVersion: true,
        ruleRequireOnJoin: true,
        ruleRequireOnPost: true,
        ruleRequireOnUpdate: true,
        rulePolicyUpdatedAt: true,
      },
    });

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

  async addUnitRealm(
    realmUnitId: string,
    unitId: string,
  ): Promise<UnitRealmDTO> {
    const row = await prisma.unitRealm.create({
      data: { realmUnitId, unitId },
    });
    await Promise.all([
      enqueueContentSearch(SEARCH_COMMAND_KINDS.contentPatchRealmIds, unitId),
      this.patchPostRealmIds(unitId),
    ]);
    return mapUnitRealmToDTO(row);
  }

  async removeUnitRealm(realmUnitId: string, unitId: string): Promise<void> {
    await prisma.unitRealm.delete({
      where: {
        realmUnitId_unitId: { realmUnitId, unitId },
      },
    });
    await Promise.all([
      enqueueContentSearch(SEARCH_COMMAND_KINDS.contentPatchRealmIds, unitId),
      this.patchPostRealmIds(unitId),
    ]);
  }

  // --- Realm tag applications ---
  //
  // RealmTagApplication and UnitTag remain independent score layers. The standard
  // RealmTagApplication write path contributes the caller's global TagVote once, but
  // later RealmTagApplication deletion never deletes or decrements UnitTag.

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
   */
  async createRealmTagApplication(
    userId: string,
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<RealmTagApplication> {
    const row = await prisma.$transaction(async (tx) => {
      await this.assertRealmAndTagTypes(realmUnitId, tagUnitId, tx);

      await tx.realmTagApplication.upsert({
        where: {
          realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
        },
        update: {},
        create: {
          realmUnitId,
          tagUnitId,
          unitId,
          score: 0,
          voteCount: 0,
        },
      });

      const existing = await tx.realmTagApplicationVote.findUnique({
        where: {
          realmUnitId_tagUnitId_unitId_userId: {
            realmUnitId,
            tagUnitId,
            unitId,
            userId,
          },
        },
      });

      if (!existing) {
        await tx.realmTagApplicationVote.create({
          data: { realmUnitId, userId, unitId, tagUnitId, value: 1 },
        });
      }

      const agg = await tx.realmTagApplicationVote.aggregate({
        where: { realmUnitId, unitId, tagUnitId },
        _sum: { value: true },
        _count: { value: true },
      });

      const realmTagApplication = await tx.realmTagApplication.update({
        where: {
          realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
        },
        data: {
          score: agg._sum.value ?? 0,
          voteCount: agg._count.value ?? 0,
        },
      });

      const globalVote = await tx.tagVote.findUnique({
        where: {
          userId_unitId_tagUnitId: { userId, unitId, tagUnitId },
        },
      });

      if (!globalVote) {
        await tx.tagVote.create({
          data: { userId, unitId, tagUnitId, value: 1 },
        });
      }

      const globalAgg = await tx.tagVote.aggregate({
        where: { unitId, tagUnitId },
        _sum: { value: true },
        _count: { value: true },
      });

      await tx.unitTag.upsert({
        where: { unitId_tagUnitId: { unitId, tagUnitId } },
        update: {
          score: globalAgg._sum.value ?? 0,
          voteCount: globalAgg._count.value ?? 0,
        },
        create: {
          unitId,
          tagUnitId,
          score: globalAgg._sum.value ?? 0,
          voteCount: globalAgg._count.value ?? 0,
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
   */
  async setRealmTagApplicationPin(
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
    input: { pinned?: boolean; position?: string | null },
  ): Promise<RealmTagApplication> {
    const data: { pinned?: boolean; position?: string | null } = {};
    if (input.pinned !== undefined) {
      data.pinned = input.pinned;
      if (input.pinned === false) data.position = null;
    }
    if (input.position !== undefined) data.position = input.position;

    const updated = await prisma.realmTagApplication.update({
      where: {
        realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
      },
      data,
    });
    await enqueueContentSearch(
      SEARCH_COMMAND_KINDS.contentPatchRealmTagKeys,
      unitId,
    );
    return updated;
  }

  /**
   * Delete a RealmTagApplication and the underlying RealmTagApplicationVote rows for that triple.
   * Does NOT cascade to UnitTag.
   */
  async deleteRealmTagApplication(
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<void> {
    await prisma.realmTagApplication.delete({
      where: {
        realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
      },
    });
    await enqueueContentSearch(
      SEARCH_COMMAND_KINDS.contentPatchRealmTagKeys,
      unitId,
    );
  }

  /**
   * Cast a RealmTagApplicationVote upsert and recompute the parent RealmTagApplication's
   * `score` and `voteCount`. Membership check is enforced by the route at
   * write time; votes are retained even if the member later leaves.
   */
  async castRealmTagApplicationVote(
    userId: string,
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
    value: number,
  ): Promise<void> {
    const clamped = value > 0 ? 1 : -1;

    await prisma.$transaction(async (tx) => {
      await tx.realmTagApplicationVote.upsert({
        where: {
          realmUnitId_tagUnitId_unitId_userId: {
            realmUnitId,
            userId,
            unitId,
            tagUnitId,
          },
        },
        update: { value: clamped },
        create: { realmUnitId, userId, unitId, tagUnitId, value: clamped },
      });

      const agg = await tx.realmTagApplicationVote.aggregate({
        where: { realmUnitId, unitId, tagUnitId },
        _sum: { value: true },
        _count: { value: true },
      });

      await tx.realmTagApplication.update({
        where: {
          realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
        },
        data: {
          score: agg._sum.value ?? 0,
          voteCount: agg._count.value ?? 0,
        },
      });
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
   */
  async listRealmTagsForUnit(
    realmUnitId: string,
    unitId: string,
    options?: { includeBelowThreshold?: boolean },
  ): Promise<RealmTagApplication[]> {
    const where: Prisma.RealmTagApplicationWhereInput =
      options?.includeBelowThreshold
        ? { realmUnitId, unitId }
        : {
            realmUnitId,
            unitId,
            score: { gt: REALM_TAG_VISIBILITY_THRESHOLD },
          };

    return prisma.realmTagApplication.findMany({
      where,
      orderBy: [
        { pinned: "desc" },
        { position: "asc" },
        { score: "desc" },
        { tagUnitId: "asc" },
      ],
    });
  }

  /**
   * Admin-only discovery: list RealmTagApplication rows at or below the given
   * score threshold, optionally constrained to a single realm. Ordered
   * ascending so the worst offenders surface first.
   */
  async listLowScoreRealmTagApplications(
    threshold: number,
    limit: number,
    realmUnitId?: string,
  ): Promise<RealmTagApplication[]> {
    return prisma.realmTagApplication.findMany({
      where: {
        score: { lte: threshold },
        ...(realmUnitId ? { realmUnitId } : {}),
      },
      orderBy: [
        { score: "asc" },
        { realmUnitId: "asc" },
        { unitId: "asc" },
        { tagUnitId: "asc" },
      ],
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  async listByMember(
    userId: string,
    options: { publicOnly?: boolean } = {},
  ): Promise<{ realms: RealmDTO[]; total: number }> {
    const members = await prisma.realmMember.findMany({
      where: { userId },
      select: { realmUnitId: true },
    });

    const realmIds = members.map((m) => m.realmUnitId);
    if (realmIds.length === 0) return { realms: [], total: 0 };

    const where = {
      unitId: { in: realmIds },
      ...(options.publicOnly ? { isPublic: true } : {}),
    };

    const [realms, total] = await Promise.all([
      prisma.realm.findMany({
        where,
        include: realmInclude,
        orderBy: { unit: { createdAt: "desc" } },
      }),
      prisma.realm.count({ where }),
    ]);

    const hydratedRealms = await hydrateUnitOwnerUserSlugs(
      realms as RealmWithRelations[],
    );
    return {
      realms: await Promise.all(
        hydratedRealms.map(async (r) => {
          const dto = mapRealmToDTO(r);
          return {
            ...dto,
            extra: await filterRealmExtraPublic(dto.extra),
          };
        }),
      ),
      total,
    };
  }
}

export const realmService = new RealmService();
