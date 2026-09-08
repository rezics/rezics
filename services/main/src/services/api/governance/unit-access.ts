import {
	AuthenticatedGrantableUnitPermissionValues,
	isUnitPermissionDelegable,
	type RealmAccessSubjectRelation,
} from "@rezics/access";
import { and, eq, exists, inArray, isNull, ne, notExists, or, sql } from "drizzle-orm";
import Elysia from "elysia";
import { StatusCodes } from "http-status-codes";
import { users } from "../../database/schema/auth";
import { selfAuthUserIdForEntity } from "../../participation/account-query";
import { publicEntityName } from "../../participation/presentation";

import { recordAuditEvent } from "../../audit";
import session from "../../auth/session";
import { lockUnitAccessState } from "../../authorization/unit/invitations";
import { replaceUnitOwnership } from "../../authorization/unit/ownership";
import {
	expandDelegableUnitPermissions,
	isUnitPermissionApplicable,
	isUnitPermissionGrantableToAuthenticated,
	unitPermissionsForKind,
	type UnitPermission,
} from "../../authorization/unit/policy";
import { OfficialProfileIds } from "../../bootstrap/data";
import { database, type DatabaseTransaction } from "../../database";
import {
	entityIdentity,
	realm,
	unitAccessGrant,
	unitAccessInvitation,
	unitAccessRestriction,
	unitOwnership,
	unitSlugAddress,
} from "../../database/schema";
import { createGovernanceDecision } from "../../governance/decision-service";
import type { Authorization } from "../../authorization";
import { listNativeAccessCandidates } from "../../units/access-candidates";
import { readUnitStateById } from "../../units/query";
import { readUnitPresentationsInTransaction } from "../../units/presentation-reader";
import { UnitNotFound } from "../../units/errors";
import { firstUnitLocalizationTitle } from "../../units/localization";
import { RealmNotFound } from "../realms/errors";
import { toApiErrorResponse } from "../schema/response";
import { ProfileNotFound } from "../users/errors";
import {
	UnitAccessConfigurationInvalid,
	UnitAccessExpiryInvalid,
	UnitOwnerRestrictionForbidden,
	UnitOwnershipChanged,
	UnitOwnershipRelinquishmentForbidden,
	UnitOwnershipTargetIneligible,
} from "./errors";
import {
	ListUnitAccessCandidatesQuery,
	ListOwnershipTransferCandidatesQuery,
	RelinquishUnitOwnershipBody,
	ReplaceUnitSubjectAccessBody,
	TransferUnitOwnershipBody,
	UnitAccessCandidateListResponse,
	UnitAccessSnapshotResponse,
	UnitEffectiveAccessQuery,
	UnitEffectiveAccessResponse,
	UnitGovernanceParams,
	UnitOwnershipCandidateListResponse,
	UnitOwnershipResponse,
} from "./schema";

type AccessSubject =
	| { readonly kind: "auth"; readonly authUserId: string }
	| {
			readonly kind: "realm";
			readonly realmId: string;
			readonly relation: RealmAccessSubjectRelation;
	  }
	| { readonly kind: "authenticated" };

const UnitGovernanceForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitAccessRestricted",
	"PlatformCapabilityRequired",
]);

function parseExpiry(value: string | undefined): Date | null {
	if (!value) return null;
	const expiresAt = new Date(value);
	if (expiresAt <= new Date()) throw new UnitAccessExpiryInvalid();
	return expiresAt;
}

function subjectKey(subject: AccessSubject): string {
	if (subject.kind === "auth") return `auth:${subject.authUserId}`;
	if (subject.kind === "realm") return `realm:${subject.realmId}:${subject.relation}`;
	return "authenticated";
}

function grantSubject(record: typeof unitAccessGrant.$inferSelect): AccessSubject {
	if (
		record.subjectKind === "auth" &&
		record.authUserId &&
		!record.realmId &&
		!record.realmRelation
	)
		return { kind: "auth", authUserId: record.authUserId };
	if (
		record.subjectKind === "realm" &&
		record.realmId &&
		record.realmRelation &&
		!record.authUserId
	)
		return { kind: "realm", realmId: record.realmId, relation: record.realmRelation };
	if (
		record.subjectKind === "authenticated" &&
		!record.authUserId &&
		!record.realmId &&
		!record.realmRelation
	)
		return { kind: "authenticated" };
	throw new Error(`Invalid Unit access grant subject shape: ${record.id}`);
}

function restrictionSubject(record: typeof unitAccessRestriction.$inferSelect): AccessSubject {
	if (
		record.subjectKind === "auth" &&
		record.authUserId &&
		!record.realmId &&
		!record.realmRelation
	)
		return { kind: "auth", authUserId: record.authUserId };
	if (
		record.subjectKind === "realm" &&
		record.realmId &&
		record.realmRelation &&
		!record.authUserId
	)
		return { kind: "realm", realmId: record.realmId, relation: record.realmRelation };
	throw new Error(`Invalid Unit access restriction subject shape: ${record.id}`);
}

function subjectGrantCondition(subject: AccessSubject, scope: readonly string[]) {
	return and(
		eq(unitAccessGrant.scope, [...scope]),
		subject.kind === "auth"
			? and(
					eq(unitAccessGrant.subjectKind, "auth"),
					eq(unitAccessGrant.authUserId, subject.authUserId),
				)
			: subject.kind === "realm"
				? and(
						eq(unitAccessGrant.subjectKind, "realm"),
						eq(unitAccessGrant.realmId, subject.realmId),
						eq(unitAccessGrant.realmRelation, subject.relation),
					)
				: eq(unitAccessGrant.subjectKind, "authenticated"),
	);
}

function subjectRestrictionCondition(
	subject: Exclude<AccessSubject, { kind: "authenticated" }>,
	scope: readonly string[],
) {
	return and(
		eq(unitAccessRestriction.scope, [...scope]),
		subject.kind === "auth"
			? and(
					eq(unitAccessRestriction.subjectKind, "auth"),
					eq(unitAccessRestriction.authUserId, subject.authUserId),
				)
			: and(
					eq(unitAccessRestriction.subjectKind, "realm"),
					eq(unitAccessRestriction.realmId, subject.realmId),
					eq(unitAccessRestriction.realmRelation, subject.relation),
				),
	);
}

async function ensureSubjectExists(subject: AccessSubject): Promise<void> {
	if (subject.kind === "auth") {
		const [record] = await database
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.id, subject.authUserId), isNull(users.erasedAt)))
			.limit(1);
		if (!record) throw new ProfileNotFound();
	}
	if (subject.kind === "realm") {
		const [record] = await database
			.select({ id: realm.id })
			.from(realm)
			.where(eq(realm.id, subject.realmId))
			.limit(1);
		if (!record) throw new RealmNotFound();
	}
}

async function recordAccessAudit(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly action: string;
		readonly unitId: string;
		readonly governanceDecisionId?: string;
		readonly metadata?: Record<string, unknown>;
	},
) {
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "unit", id: input.unitId },
		action: input.action,
		governanceDecisionId: input.governanceDecisionId,
		target: { kind: "unit", id: input.unitId },
		details: input.metadata,
	});
}

async function getAccessSnapshot(
	unitId: string,
	scope: readonly string[],
	authorization: Authorization<string>,
) {
	return database.transaction(
		async (tx) => {
			await authorization.unit.ensureInTransaction(tx, unitId, "unit.access.manage", scope);
			const target = await readUnitStateById(tx, unitId);
			if (!target) throw new UnitNotFound();
			const presentations = await readUnitPresentationsInTransaction(tx, [unitId]);
			const viewerProfileId = authorization.profileId;

			const [ownership, grants, restrictions] = await Promise.all([
				tx
					.select({
						profileId: unitOwnership.profileId,
						authUserId: selfAuthUserIdForEntity(unitOwnership.profileId),
						label: publicEntityName(unitOwnership.profileId),
					})
					.from(unitOwnership)
					.where(and(eq(unitOwnership.unitId, unitId), isNull(unitOwnership.revokedAt)))
					.limit(1),
				tx
					.select()
					.from(unitAccessGrant)
					.where(
						and(
							eq(unitAccessGrant.unitId, unitId),
							eq(unitAccessGrant.scope, [...scope]),
							isNull(unitAccessGrant.revokedAt),
							or(isNull(unitAccessGrant.expiresAt), sql`${unitAccessGrant.expiresAt} > now()`),
						),
					),
				tx
					.select()
					.from(unitAccessRestriction)
					.where(
						and(
							eq(unitAccessRestriction.unitId, unitId),
							eq(unitAccessRestriction.scope, [...scope]),
							isNull(unitAccessRestriction.revokedAt),
							or(
								isNull(unitAccessRestriction.expiresAt),
								sql`${unitAccessRestriction.expiresAt} > now()`,
							),
						),
					),
			]);

			const subjects = new Map<
				string,
				{
					subject: AccessSubject;
					grants: Set<UnitPermission>;
					restrictions: Set<UnitPermission>;
					expiries: Set<number | null>;
				}
			>();
			const ensureSubject = (subject: AccessSubject) => {
				const key = subjectKey(subject);
				const current = subjects.get(key);
				if (current) return current;
				const created = {
					subject,
					grants: new Set<UnitPermission>(),
					restrictions: new Set<UnitPermission>(),
					expiries: new Set<number | null>(),
				};
				subjects.set(key, created);
				return created;
			};
			ensureSubject({ kind: "authenticated" });
			if (target.reference.owner === "realm")
				ensureSubject({ kind: "realm", realmId: unitId, relation: "member" });
			if (ownership[0]?.authUserId)
				ensureSubject({ kind: "auth", authUserId: ownership[0].authUserId });
			for (const grant of grants) {
				const row = ensureSubject(grantSubject(grant));
				row.grants.add(grant.permission);
				row.expiries.add(grant.expiresAt?.getTime() ?? null);
			}
			for (const restriction of restrictions) {
				const row = ensureSubject(restrictionSubject(restriction));
				row.restrictions.add(restriction.permission);
				row.expiries.add(restriction.expiresAt?.getTime() ?? null);
			}

			const authIds = [...subjects.values()].flatMap(({ subject }) =>
				subject.kind === "auth" ? [subject.authUserId] : [],
			);
			const realmIds = [...subjects.values()].flatMap(({ subject }) =>
				subject.kind === "realm" ? [subject.realmId] : [],
			);
			const [accounts, realms] = await Promise.all([
				authIds.length
					? tx
							.select({ id: users.id, label: users.name })
							.from(users)
							.where(inArray(users.id, authIds))
					: [],
				realmIds.length
					? tx
							.select({ id: realm.id, label: firstUnitLocalizationTitle(realm.id) })
							.from(realm)
							.where(inArray(realm.id, realmIds))
					: [],
			]);
			const labelByKey = new Map([
				...accounts.map((row) => [`auth:${row.id}`, row.label] as const),
				...realms.map((row) => [`realm:${row.id}`, row.label] as const),
			]);
			const authenticated = subjects.get("authenticated");
			const publicRead =
				target.status === "published" &&
				target.moderationStatus === "approved" &&
				(target.visibility === "public" || target.visibility === "unlisted");
			const inheritedBase = new Set<UnitPermission>([
				...(publicRead ? (["unit.read"] as const) : []),
				...(authenticated?.grants ?? []),
			]);
			const orderedPermissions = unitPermissionsForKind(target.reference.owner);
			const delegablePermissions = orderedPermissions.filter(isUnitPermissionDelegable);

			return {
				unitId,
				unitTitle: presentations.get(unitId)?.title ?? null,
				unitOwner: target.reference.owner,
				shape: target.shape,
				permissions: delegablePermissions,
				authenticatedGrantablePermissions: AuthenticatedGrantableUnitPermissionValues.filter(
					(permission) => delegablePermissions.includes(permission),
				),
				owner: ownership[0]
					? { entityId: ownership[0].profileId, label: ownership[0].label }
					: null,
				canTransferOwnership: ownership[0]?.profileId === viewerProfileId,
				canRelinquishOwnership:
					ownership[0]?.profileId === viewerProfileId &&
					ownership[0].profileId !== OfficialProfileIds.community,
				subjects: [...subjects.values()]
					.map((row) => {
						const inherited =
							row.subject.kind === "authenticated"
								? publicRead
									? ["unit.read" as const]
									: []
								: delegablePermissions.filter((permission) => inheritedBase.has(permission));
						const expiryValues = [...row.expiries];
						return {
							subject: row.subject,
							label:
								row.subject.kind === "auth"
									? (labelByKey.get(`auth:${row.subject.authUserId}`) ?? null)
									: row.subject.kind === "realm"
										? (labelByKey.get(`realm:${row.subject.realmId}`) ?? null)
										: null,
							grants: delegablePermissions.filter((permission) => row.grants.has(permission)),
							restrictions: delegablePermissions.filter((permission) =>
								row.restrictions.has(permission),
							),
							inherited,
							expiresAt:
								expiryValues.length === 1 && expiryValues[0] != null
									? new Date(expiryValues[0])
									: null,
						};
					})
					.sort((left, right) => {
						const leftIsTargetMembers =
							left.subject.kind === "realm" &&
							left.subject.realmId === unitId &&
							left.subject.relation === "member";
						const rightIsTargetMembers =
							right.subject.kind === "realm" &&
							right.subject.realmId === unitId &&
							right.subject.relation === "member";
						if (leftIsTargetMembers) return -1;
						if (rightIsTargetMembers) return 1;
						if (left.subject.kind === "authenticated") return -1;
						if (right.subject.kind === "authenticated") return 1;
						return (left.label ?? subjectKey(left.subject)).localeCompare(
							right.label ?? subjectKey(right.subject),
						);
					}),
			};
		},
		{ isolationLevel: "repeatable read" },
	);
}

function eligibleOwnershipCandidateCondition(unitId: string) {
	return and(
		ne(entityIdentity.id, OfficialProfileIds.community),
		isNull(entityIdentity.deletedAt),
		sql`exists(select 1 from public.auth_entity active_self join public.users active_account on active_account.id=active_self.auth_user_id where active_self.entity_id=${entityIdentity.id} and active_self.state='active' and active_account.erased_at is null)`,
		exists(
			database
				.select({ id: unitAccessInvitation.id })
				.from(unitAccessInvitation)
				.where(
					and(
						eq(unitAccessInvitation.unitId, unitId),
						eq(unitAccessInvitation.invitedAuthUserId, selfAuthUserIdForEntity(entityIdentity.id)),
						eq(unitAccessInvitation.resolution, "accepted"),
						sql`cardinality(${unitAccessInvitation.scope}) = 0`,
						isNull(unitAccessInvitation.accessExpiresAt),
						sql`${unitAccessInvitation.permissions} @> array['unit.update']::unit_permission[]`,
					),
				),
		),
		exists(
			database
				.select({ id: unitAccessGrant.id })
				.from(unitAccessGrant)
				.where(
					and(
						eq(unitAccessGrant.unitId, unitId),
						eq(unitAccessGrant.subjectKind, "auth"),
						eq(unitAccessGrant.authUserId, selfAuthUserIdForEntity(entityIdentity.id)),
						eq(unitAccessGrant.permission, "unit.update"),
						sql`cardinality(${unitAccessGrant.scope}) = 0`,
						isNull(unitAccessGrant.expiresAt),
						isNull(unitAccessGrant.revokedAt),
					),
				),
		),
		notExists(
			database
				.select({ id: unitAccessRestriction.id })
				.from(unitAccessRestriction)
				.where(
					and(
						eq(unitAccessRestriction.unitId, unitId),
						eq(unitAccessRestriction.subjectKind, "auth"),
						eq(unitAccessRestriction.authUserId, selfAuthUserIdForEntity(entityIdentity.id)),
						eq(unitAccessRestriction.permission, "unit.update"),
						sql`cardinality(${unitAccessRestriction.scope}) = 0`,
						isNull(unitAccessRestriction.revokedAt),
						or(
							isNull(unitAccessRestriction.expiresAt),
							sql`${unitAccessRestriction.expiresAt} > now()`,
						),
					),
				),
		),
		notExists(
			database
				.select({ id: unitOwnership.id })
				.from(unitOwnership)
				.where(
					and(
						eq(unitOwnership.unitId, unitId),
						eq(unitOwnership.profileId, entityIdentity.id),
						isNull(unitOwnership.revokedAt),
					),
				),
		),
	);
}

async function isEligibleOwnershipCandidate(
	tx: DatabaseTransaction,
	unitId: string,
	profileId: string,
): Promise<boolean> {
	const [candidate] = await tx
		.select({ id: entityIdentity.id })
		.from(entityIdentity)
		.where(and(eq(entityIdentity.id, profileId), eligibleOwnershipCandidateCondition(unitId)))
		.limit(1);
	return Boolean(candidate);
}

export default new Elysia({ prefix: "/unit" })
	.use(session)
	.get(
		"/:unitId/access",
		{
			access: "session-only",
			params: UnitGovernanceParams,
			query: UnitEffectiveAccessQuery,
			response: {
				[StatusCodes.OK]: UnitAccessSnapshotResponse,
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Get Unit access configuration", tags: ["Governance"] },
		},
		async ({ authorization, params, query }) => {
			await authorization.unit.ensure(params.unitId, "unit.access.manage", query.scope ?? []);
			return getAccessSnapshot(params.unitId, query.scope ?? [], authorization);
		},
	)
	.put(
		"/:unitId/access",
		{
			access: "fresh-session-only",
			params: UnitGovernanceParams,
			body: ReplaceUnitSubjectAccessBody,
			response: {
				[StatusCodes.OK]: UnitAccessSnapshotResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"UnitAccessExpiryInvalid",
					"UnitAccessConfigurationInvalid",
					"GovernanceRuleSourceForbidden",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitPermissionForbidden",
					"UnitAccessRestricted",
					"FreshSessionRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ProfileNotFound",
					"RealmNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitOwnerRestrictionForbidden",
					"GovernanceRuleChanged",
				]),
			},
			detail: { summary: "Replace Unit subject access", tags: ["Governance"] },
		},
		async ({ authorization, entity, user, params, body }) => {
			const expiresAt = parseExpiry(body.expiresAt);
			await ensureSubjectExists(body.subject);
			await database.transaction(async (tx) => {
				await lockUnitAccessState(tx, [params.unitId]);
				const target = await readUnitStateById(tx, params.unitId);
				if (!target) throw new UnitNotFound();
				await authorization.unit.ensureInTransaction(
					tx,
					params.unitId,
					"unit.access.manage",
					body.scope,
				);
				const requestedGrants = expandDelegableUnitPermissions(body.grants);
				const requestedRestrictions = [...body.restrictions];
				for (const permission of [...requestedGrants, ...requestedRestrictions]) {
					if (
						!isUnitPermissionDelegable(permission) ||
						!isUnitPermissionApplicable(target.reference.owner, permission)
					)
						throw new UnitAccessConfigurationInvalid();
					await authorization.unit.ensureInTransaction(tx, params.unitId, permission, body.scope);
				}
				if (
					body.subject.kind === "authenticated" &&
					(requestedRestrictions.length ||
						requestedGrants.some(
							(permission) => !isUnitPermissionGrantableToAuthenticated(permission),
						))
				)
					throw new UnitAccessConfigurationInvalid();
				if (
					body.subject.kind === "realm" &&
					body.subject.relation === "access_manager" &&
					target.reference.owner === "realm"
				)
					throw new UnitAccessConfigurationInvalid();
				const grantSet = new Set(requestedGrants);
				if (requestedRestrictions.some((permission) => grantSet.has(permission)))
					throw new UnitAccessConfigurationInvalid();
				const [currentRestriction] =
					body.subject.kind === "authenticated"
						? []
						: await tx
								.select({ id: unitAccessRestriction.id })
								.from(unitAccessRestriction)
								.where(
									and(
										eq(unitAccessRestriction.unitId, params.unitId),
										subjectRestrictionCondition(body.subject, body.scope),
										isNull(unitAccessRestriction.revokedAt),
										or(
											isNull(unitAccessRestriction.expiresAt),
											sql`${unitAccessRestriction.expiresAt} > now()`,
										),
									),
								)
								.limit(1);
				const restrictionPolicyTouched = Boolean(
					requestedRestrictions.length || currentRestriction,
				);
				const decision = restrictionPolicyTouched
					? await createGovernanceDecision(tx, {
							action: currentRestriction
								? requestedRestrictions.length
									? "unit.access.replace_restrictions"
									: "unit.access.clear_restrictions"
								: "unit.access.restrict",
							actorProfileId: entity.id,
							authority: { kind: "unit", unitId: params.unitId },
							targetUnitId: params.unitId,
							subject:
								body.subject.kind === "auth"
									? { kind: "unit_access_profile", id: body.subject.authUserId }
									: body.subject.kind === "realm"
										? { kind: "unit_access_realm", id: body.subject.realmId }
										: { kind: "unit_access_authenticated", id: params.unitId },
							basis: { kind: "rules", rules: "rules" in body ? (body.rules ?? []) : [] },
						})
					: undefined;

				if (body.subject.kind === "auth") {
					const [ownership] = await tx
						.select({ id: unitOwnership.id })
						.from(unitOwnership)
						.where(
							and(
								eq(unitOwnership.unitId, params.unitId),
								eq(selfAuthUserIdForEntity(unitOwnership.profileId), body.subject.authUserId),
								isNull(unitOwnership.revokedAt),
							),
						)
						.limit(1);
					if (ownership) throw new UnitOwnerRestrictionForbidden();
				}

				const now = new Date();
				await tx
					.update(unitAccessGrant)
					.set({
						revokedAt: now,
						revokedByAuthUserId: user.id,
						updatedAt: now,
					})
					.where(
						and(
							eq(unitAccessGrant.unitId, params.unitId),
							subjectGrantCondition(body.subject, body.scope),
							isNull(unitAccessGrant.revokedAt),
						),
					);
				if (requestedGrants.length)
					await tx.insert(unitAccessGrant).values(
						requestedGrants.map((permission) => ({
							unitId: params.unitId,
							subjectKind: body.subject.kind,
							authUserId: body.subject.kind === "auth" ? body.subject.authUserId : null,
							realmId: body.subject.kind === "realm" ? body.subject.realmId : null,
							realmRelation: body.subject.kind === "realm" ? body.subject.relation : null,
							permission,
							scope: body.scope,
							grantedByAuthUserId: user.id,
							expiresAt,
						})),
					);

				if (body.subject.kind !== "authenticated") {
					await tx
						.update(unitAccessRestriction)
						.set({
							revokedAt: now,
							revokedByAuthUserId: user.id,
							updatedAt: now,
						})
						.where(
							and(
								eq(unitAccessRestriction.unitId, params.unitId),
								subjectRestrictionCondition(body.subject, body.scope),
								isNull(unitAccessRestriction.revokedAt),
							),
						);
					if (requestedRestrictions.length) {
						const restrictionSubjectKind = body.subject.kind;
						await tx.insert(unitAccessRestriction).values(
							requestedRestrictions.map((permission) => ({
								unitId: params.unitId,
								subjectKind: restrictionSubjectKind,
								authUserId: body.subject.kind === "auth" ? body.subject.authUserId : null,
								realmId: body.subject.kind === "realm" ? body.subject.realmId : null,
								realmRelation: body.subject.kind === "realm" ? body.subject.relation : null,
								permission,
								scope: body.scope,
								decisionId: decision!.id,
								createdByAuthUserId: user.id,
								expiresAt,
							})),
						);
					}
				}
				await recordAccessAudit(tx, {
					actorProfileId: entity.id,
					action: "unit.access.replace",
					unitId: params.unitId,
					governanceDecisionId: decision?.id,
					metadata: {
						subject: body.subject,
						grants: requestedGrants,
						restrictions: requestedRestrictions,
						scope: body.scope,
						expiresAt,
					},
				});
			});
			return getAccessSnapshot(params.unitId, body.scope, authorization);
		},
	)
	.get(
		"/:unitId/access-candidates",
		{
			access: "session-only",
			params: UnitGovernanceParams,
			query: ListUnitAccessCandidatesQuery,
			response: {
				[StatusCodes.OK]: UnitAccessCandidateListResponse,
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
			},
			detail: { summary: "Search Unit access candidates", tags: ["Governance"] },
		},
		async ({ authorization, params, query }) => {
			const result = await listNativeAccessCandidates(authorization, {
				unitId: params.unitId,
				kind: query.kind,
				query: query.query,
				cursor: query.cursor,
				limit: query.limit ?? 20,
			});
			return {
				items: result.items.map(({ subject, label }) => ({ subject, label })),
				nextCursor: result.nextCursor,
			};
		},
	)
	.get(
		"/:unitId/access/effective",
		{
			access: "session-only",
			params: UnitGovernanceParams,
			query: UnitEffectiveAccessQuery,
			response: { [StatusCodes.OK]: UnitEffectiveAccessResponse },
			detail: {
				summary: "Resolve effective Unit access for the current Profile",
				tags: ["Governance"],
			},
		},
		async ({ authorization, params, query }) => {
			const scope = query.scope ?? [];
			const target = await readUnitStateById(database, params.unitId);
			if (!target) throw new UnitNotFound();
			return {
				unitId: params.unitId,
				scope,
				decisions: await Promise.all(
					unitPermissionsForKind(target.reference.owner).map(async (permission) => ({
						permission,
						decision: await authorization.unit.decide(params.unitId, permission, scope),
					})),
				),
			};
		},
	)
	.get(
		"/:unitId/ownership/candidates",
		{
			access: "session-only",
			params: UnitGovernanceParams,
			query: ListOwnershipTransferCandidatesQuery,
			response: {
				[StatusCodes.OK]: UnitOwnershipCandidateListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitPermissionForbidden"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Search eligible Unit ownership recipients", tags: ["Governance"] },
		},
		async ({ authorization, params, query }) => {
			const page = await listNativeAccessCandidates(authorization, {
				unitId: params.unitId,
				kind: "auth",
				query: query.query,
				cursor: query.cursor,
				limit: query.limit ?? 50,
				permission: "unit.ownership.transfer",
			});
			const ids = page.items.flatMap((item) => (item.entityId ? [item.entityId] : []));
			return database.transaction(
				async (tx) => {
					await authorization.unit.ensureInTransaction(
						tx,
						params.unitId,
						"unit.ownership.transfer",
					);
					const eligible = ids.length
						? await tx
								.select({ entityId: entityIdentity.id, slug: unitSlugAddress.slug })
								.from(entityIdentity)
								.leftJoin(
									unitSlugAddress,
									and(
										eq(unitSlugAddress.targetUnitId, entityIdentity.id),
										eq(unitSlugAddress.kind, "canonical"),
									),
								)
								.where(
									and(
										inArray(entityIdentity.id, ids),
										eligibleOwnershipCandidateCondition(params.unitId),
									),
								)
								.limit(ids.length)
						: [];
					const byId = new Map(eligible.map((row) => [row.entityId, row]));
					return {
						items: page.items.flatMap((item) => {
							const match = item.entityId ? byId.get(item.entityId) : undefined;
							return match ? [{ ...match, label: item.label }] : [];
						}),
						nextCursor: page.nextCursor,
					};
				},
				{ isolationLevel: "repeatable read" },
			);
		},
	)
	.put(
		"/:unitId/ownership",
		{
			access: "fresh-session-only",
			params: UnitGovernanceParams,
			body: TransferUnitOwnershipBody,
			response: {
				[StatusCodes.OK]: UnitOwnershipResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitPermissionForbidden",
					"FreshSessionRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ProfileNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitOwnershipChanged",
					"UnitOwnershipTargetIneligible",
				]),
			},
			detail: { summary: "Transfer Unit ownership", tags: ["Governance"] },
		},
		async ({ authorization, entity, params, body }) => {
			return database.transaction(async (tx) => {
				await lockUnitAccessState(tx, [params.unitId]);
				await authorization.unit.ensureInTransaction(tx, params.unitId, "unit.ownership.transfer");
				if (body.expectedOwnerEntityId !== entity.id) throw new UnitOwnershipChanged();
				if (!(await isEligibleOwnershipCandidate(tx, params.unitId, body.targetEntityId)))
					throw new UnitOwnershipTargetIneligible();
				const now = new Date();
				const replaced = await replaceUnitOwnership(tx, {
					unitId: params.unitId,
					expectedOwnerProfileId: body.expectedOwnerEntityId,
					targetProfileId: body.targetEntityId,
					actorProfileId: entity.id,
					now,
				});
				if (!replaced.ok) {
					if (replaced.reason === "owner_unchanged") throw new UnitOwnershipTargetIneligible();
					throw new UnitOwnershipChanged();
				}
				await recordAccessAudit(tx, {
					actorProfileId: entity.id,
					action: "unit.ownership.transfer",
					unitId: params.unitId,
					metadata: {
						previousOwnerProfileId: replaced.previousOwnerProfileId,
						ownerProfileId: body.targetEntityId,
					},
				});
				const [owner] = await tx
					.select({
						entityId: entityIdentity.id,
						label: publicEntityName(entityIdentity.id),
					})
					.from(entityIdentity)
					.where(eq(entityIdentity.id, body.targetEntityId))
					.limit(1);
				if (!owner) throw new UnitOwnershipTargetIneligible();
				return {
					owner,
				};
			});
		},
	)
	.post(
		"/:unitId/ownership/relinquishment",
		{
			access: "fresh-session-only",
			params: UnitGovernanceParams,
			body: RelinquishUnitOwnershipBody,
			response: {
				[StatusCodes.OK]: UnitOwnershipResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitPermissionForbidden",
					"FreshSessionRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitOwnershipChanged",
					"UnitOwnershipRelinquishmentForbidden",
				]),
			},
			detail: { summary: "Relinquish Unit ownership to Community", tags: ["Governance"] },
		},
		async ({ authorization, entity, params, body }) => {
			const result = await database.transaction(async (tx) => {
				await lockUnitAccessState(tx, [params.unitId]);
				await authorization.unit.ensureInTransaction(tx, params.unitId, "unit.ownership.transfer");
				if (body.expectedOwnerEntityId !== entity.id) throw new UnitOwnershipChanged();
				if (body.expectedOwnerEntityId === OfficialProfileIds.community)
					throw new UnitOwnershipRelinquishmentForbidden();
				const now = new Date();
				const replaced = await replaceUnitOwnership(tx, {
					unitId: params.unitId,
					expectedOwnerProfileId: body.expectedOwnerEntityId,
					targetProfileId: OfficialProfileIds.community,
					actorProfileId: entity.id,
					now,
				});
				if (!replaced.ok) {
					if (replaced.reason === "owner_unchanged")
						throw new UnitOwnershipRelinquishmentForbidden();
					throw new UnitOwnershipChanged();
				}
				await recordAccessAudit(tx, {
					actorProfileId: entity.id,
					action: "unit.ownership.relinquish",
					unitId: params.unitId,
					metadata: {
						previousOwnerProfileId: replaced.previousOwnerProfileId,
						ownerProfileId: OfficialProfileIds.community,
					},
				});
				const [owner] = await tx
					.select({
						entityId: entityIdentity.id,
						label: publicEntityName(entityIdentity.id),
					})
					.from(entityIdentity)
					.where(eq(entityIdentity.id, OfficialProfileIds.community))
					.limit(1);
				if (!owner) throw new ProfileNotFound();
				return {
					owner,
				};
			});
			return result;
		},
	);
