import { StatusCodes } from "http-status-codes";
import {
	AuthenticatedGrantableUnitPermissionValues,
	isUnitPermissionDelegable,
} from "@rezics/access";
import { and, eq, exists, gt, inArray, isNull, ne, notExists, or, sql } from "drizzle-orm";
import Elysia from "elysia";

import { recordAuditEvent } from "../../audit";
import session from "../../auth/session";
import { lockUnitAccessState } from "../../authorization/unit/invitations";
import { replaceUnitOwnership } from "../../authorization/unit/ownership";
import { OfficialProfileIds } from "../../bootstrap/manifest";
import {
	expandDelegableUnitPermissions,
	isUnitPermissionApplicable,
	isUnitPermissionGrantableToAuthenticated,
	unitPermissionsForKind,
	type UnitPermission,
} from "../../authorization/unit/policy";
import { database, type DatabaseTransaction } from "../../database";
import {
	profile as profileTable,
	realm,
	unit,
	unitAccessGrant,
	unitAccessInvitation,
	unitAccessRestriction,
	unitOwnership,
	unitSlugAddress,
} from "../../database/schema";
import { firstUnitLocalizationTitle } from "../../units/localization";
import { UnitNotFound } from "../../units/errors";
import { toApiErrorResponse } from "../schema/response";
import { RealmNotFound } from "../realms/errors";
import { ProfileNotFound } from "../users/errors";
import {
	ListUnitAccessCandidatesQuery,
	ListUnitOwnershipCandidatesQuery,
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
import {
	UnitAccessExpiryInvalid,
	UnitAccessConfigurationInvalid,
	UnitOwnerRestrictionForbidden,
	UnitOwnershipChanged,
	UnitOwnershipRelinquishmentForbidden,
	UnitOwnershipTargetIneligible,
} from "./errors";

type AccessSubject =
	| { readonly kind: "profile"; readonly profileId: string }
	| { readonly kind: "realm"; readonly realmId: string }
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
	if (subject.kind === "profile") return `profile:${subject.profileId}`;
	if (subject.kind === "realm") return `realm:${subject.realmId}`;
	return "authenticated";
}

function grantSubject(record: typeof unitAccessGrant.$inferSelect): AccessSubject {
	if (record.subjectKind === "profile" && record.profileId && !record.realmId)
		return { kind: "profile", profileId: record.profileId };
	if (record.subjectKind === "realm" && record.realmId && !record.profileId)
		return { kind: "realm", realmId: record.realmId };
	if (record.subjectKind === "authenticated" && !record.profileId && !record.realmId)
		return { kind: "authenticated" };
	throw new Error(`Invalid Unit access grant subject shape: ${record.id}`);
}

function restrictionSubject(record: typeof unitAccessRestriction.$inferSelect): AccessSubject {
	if (record.subjectKind === "profile" && record.profileId && !record.realmId)
		return { kind: "profile", profileId: record.profileId };
	if (record.subjectKind === "realm" && record.realmId && !record.profileId)
		return { kind: "realm", realmId: record.realmId };
	throw new Error(`Invalid Unit access restriction subject shape: ${record.id}`);
}

function subjectGrantCondition(subject: AccessSubject, scope: readonly string[]) {
	return and(
		eq(unitAccessGrant.scope, [...scope]),
		subject.kind === "profile"
			? and(
					eq(unitAccessGrant.subjectKind, "profile"),
					eq(unitAccessGrant.profileId, subject.profileId),
				)
			: subject.kind === "realm"
				? and(
						eq(unitAccessGrant.subjectKind, "realm"),
						eq(unitAccessGrant.realmId, subject.realmId),
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
		subject.kind === "profile"
			? and(
					eq(unitAccessRestriction.subjectKind, "profile"),
					eq(unitAccessRestriction.profileId, subject.profileId),
				)
			: and(
					eq(unitAccessRestriction.subjectKind, "realm"),
					eq(unitAccessRestriction.realmId, subject.realmId),
				),
	);
}

async function ensureSubjectExists(subject: AccessSubject): Promise<void> {
	if (subject.kind === "profile") {
		const [record] = await database
			.select({ id: profileTable.id })
			.from(profileTable)
			.where(eq(profileTable.id, subject.profileId))
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
		readonly metadata?: Record<string, unknown>;
	},
) {
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "unit", id: input.unitId },
		action: input.action,
		target: { kind: "unit", id: input.unitId },
		details: input.metadata,
	});
}

async function getAccessSnapshot(
	unitId: string,
	scope: readonly string[],
	viewerProfileId: string,
) {
	const [target] = await database
		.select({
			id: unit.id,
			title: firstUnitLocalizationTitle(unit.id),
			kind: unit.kind,
			status: unit.status,
			visibility: unit.visibility,
			moderationStatus: unit.moderationStatus,
		})
		.from(unit)
		.where(and(eq(unit.id, unitId), isNull(unit.deletedAt)))
		.limit(1);
	if (!target) throw new UnitNotFound();

	const [ownership, grants, restrictions] = await Promise.all([
		database
			.select({
				profileId: unitOwnership.profileId,
				label: firstUnitLocalizationTitle(unitOwnership.profileId),
			})
			.from(unitOwnership)
			.where(and(eq(unitOwnership.unitId, unitId), isNull(unitOwnership.revokedAt)))
			.limit(1),
		database
			.select()
			.from(unitAccessGrant)
			.where(
				and(
					eq(unitAccessGrant.unitId, unitId),
					eq(unitAccessGrant.scope, [...scope]),
					isNull(unitAccessGrant.revokedAt),
					or(
						isNull(unitAccessGrant.expiresAt),
						sql`${unitAccessGrant.expiresAt} > now()`,
					),
				),
			),
		database
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
	if (ownership[0]) ensureSubject({ kind: "profile", profileId: ownership[0].profileId });
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

	const ids = [...subjects.values()].flatMap(({ subject }) =>
		subject.kind === "profile"
			? [subject.profileId]
			: subject.kind === "realm"
				? [subject.realmId]
				: [],
	);
	const labels = ids.length
		? await database
				.select({ id: unit.id, label: firstUnitLocalizationTitle(unit.id) })
				.from(unit)
				.where(inArray(unit.id, ids))
		: [];
	const labelById = new Map(labels.map(({ id, label }) => [id, label]));
	const authenticated = subjects.get("authenticated");
	const publicRead =
		target.status === "published" &&
		target.moderationStatus === "approved" &&
		(target.visibility === "public" || target.visibility === "unlisted");
	const inheritedBase = new Set<UnitPermission>([
		...(publicRead ? (["unit.read"] as const) : []),
		...(authenticated?.grants ?? []),
	]);
	const orderedPermissions = unitPermissionsForKind(target.kind);
	const delegablePermissions = orderedPermissions.filter(isUnitPermissionDelegable);

	return {
		unitId,
		unitTitle: target.title,
		unitKind: target.kind,
		permissions: delegablePermissions,
		authenticatedGrantablePermissions: AuthenticatedGrantableUnitPermissionValues.filter(
			(permission) => delegablePermissions.includes(permission),
		),
		owner: ownership[0] ?? null,
		canTransferOwnership: ownership[0]?.profileId === viewerProfileId,
		canRelinquishOwnership:
			ownership[0]?.profileId === viewerProfileId &&
			ownership[0].profileId !== OfficialProfileIds.community,
		subjects: [...subjects.values()]
			.map((row) => {
				const id =
					row.subject.kind === "profile"
						? row.subject.profileId
						: row.subject.kind === "realm"
							? row.subject.realmId
							: undefined;
				const inherited =
					row.subject.kind === "authenticated"
						? publicRead
							? ["unit.read" as const]
							: []
						: delegablePermissions.filter((permission) =>
								inheritedBase.has(permission),
							);
				const expiryValues = [...row.expiries];
				return {
					subject: row.subject,
					label: id ? (labelById.get(id) ?? null) : null,
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
				if (left.subject.kind === "authenticated") return -1;
				if (right.subject.kind === "authenticated") return 1;
				return (left.label ?? subjectKey(left.subject)).localeCompare(
					right.label ?? subjectKey(right.subject),
				);
			}),
	};
}

function eligibleOwnershipCandidateCondition(unitId: string) {
	return and(
		ne(profileTable.id, OfficialProfileIds.community),
		isNull(unit.deletedAt),
		exists(
			database
				.select({ id: unitAccessInvitation.id })
				.from(unitAccessInvitation)
				.where(
					and(
						eq(unitAccessInvitation.unitId, unitId),
						eq(unitAccessInvitation.invitedProfileId, profileTable.id),
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
						eq(unitAccessGrant.subjectKind, "profile"),
						eq(unitAccessGrant.profileId, profileTable.id),
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
						eq(unitAccessRestriction.subjectKind, "profile"),
						eq(unitAccessRestriction.profileId, profileTable.id),
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
						eq(unitOwnership.profileId, profileTable.id),
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
		.select({ id: profileTable.id })
		.from(profileTable)
		.innerJoin(unit, eq(unit.id, profileTable.id))
		.where(and(eq(profileTable.id, profileId), eligibleOwnershipCandidateCondition(unitId)))
		.limit(1);
	return Boolean(candidate);
}

export default new Elysia({ prefix: "/unit" })
	.use(session)
	.get(
		"/:unitId/access",
		async ({ authorization, profile, params, query }) => {
			await authorization.unit.ensure(params.unitId, "unit.access.manage", query.scope ?? []);
			return getAccessSnapshot(params.unitId, query.scope ?? [], profile.unitId);
		},
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
	)
	.put(
		"/:unitId/access",
		async ({ authorization, profile, params, body }) => {
			const expiresAt = parseExpiry(body.expiresAt);
			await ensureSubjectExists(body.subject);
			await database.transaction(async (tx) => {
				await lockUnitAccessState(tx, [params.unitId]);
				const [target] = await tx
					.select({ kind: unit.kind })
					.from(unit)
					.where(and(eq(unit.id, params.unitId), isNull(unit.deletedAt)))
					.limit(1);
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
						!isUnitPermissionApplicable(target.kind, permission)
					)
						throw new UnitAccessConfigurationInvalid();
					await authorization.unit.ensureInTransaction(
						tx,
						params.unitId,
						permission,
						body.scope,
					);
				}
				if (
					body.subject.kind === "authenticated" &&
					(requestedRestrictions.length ||
						requestedGrants.some(
							(permission) => !isUnitPermissionGrantableToAuthenticated(permission),
						))
				)
					throw new UnitAccessConfigurationInvalid();
				const grantSet = new Set(requestedGrants);
				if (requestedRestrictions.some((permission) => grantSet.has(permission)))
					throw new UnitAccessConfigurationInvalid();

				if (body.subject.kind === "profile") {
					const [ownership] = await tx
						.select({ id: unitOwnership.id })
						.from(unitOwnership)
						.where(
							and(
								eq(unitOwnership.unitId, params.unitId),
								eq(unitOwnership.profileId, body.subject.profileId),
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
						revokedByProfileId: profile.unitId,
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
							profileId:
								body.subject.kind === "profile" ? body.subject.profileId : null,
							realmId: body.subject.kind === "realm" ? body.subject.realmId : null,
							permission,
							scope: body.scope,
							grantedByProfileId: profile.unitId,
							expiresAt,
						})),
					);

				if (body.subject.kind !== "authenticated") {
					await tx
						.update(unitAccessRestriction)
						.set({
							revokedAt: now,
							revokedByProfileId: profile.unitId,
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
								profileId:
									body.subject.kind === "profile" ? body.subject.profileId : null,
								realmId:
									body.subject.kind === "realm" ? body.subject.realmId : null,
								permission,
								scope: body.scope,
								reasonCode: body.reasonCode ?? "administrative",
								createdByProfileId: profile.unitId,
								expiresAt,
							})),
						);
					}
				}
				await recordAccessAudit(tx, {
					actorProfileId: profile.unitId,
					action: "unit.access.replace",
					unitId: params.unitId,
					metadata: {
						subject: body.subject,
						grants: requestedGrants,
						restrictions: requestedRestrictions,
						scope: body.scope,
						expiresAt,
					},
				});
			});
			return getAccessSnapshot(params.unitId, body.scope, profile.unitId);
		},
		{
			access: "fresh-session-only",
			params: UnitGovernanceParams,
			body: ReplaceUnitSubjectAccessBody,
			response: {
				[StatusCodes.OK]: UnitAccessSnapshotResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"UnitAccessExpiryInvalid",
					"UnitAccessConfigurationInvalid",
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
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitOwnerRestrictionForbidden"]),
			},
			detail: { summary: "Replace Unit subject access", tags: ["Governance"] },
		},
	)
	.get(
		"/:unitId/access-candidates",
		async ({ authorization, params, query }) => {
			await authorization.unit.ensure(params.unitId, "unit.access.manage");
			const search = query.query?.trim();
			const rows = await database
				.select({ id: unit.id, label: firstUnitLocalizationTitle(unit.id) })
				.from(unit)
				.where(
					and(
						eq(unit.kind, query.kind),
						isNull(unit.deletedAt),
						search
							? sql`coalesce(${firstUnitLocalizationTitle(unit.id)}, '') ilike ${`%${search}%`}`
							: undefined,
					),
				)
				.orderBy(firstUnitLocalizationTitle(unit.id), unit.id)
				.limit(query.limit ?? 20);
			return {
				items: rows.map(({ id, label }) => ({
					subject:
						query.kind === "profile"
							? ({ kind: "profile", profileId: id } as const)
							: ({ kind: "realm", realmId: id } as const),
					label,
				})),
			};
		},
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
	)
	.get(
		"/:unitId/access/effective",
		async ({ authorization, params, query }) => {
			const scope = query.scope ?? [];
			const [target] = await database
				.select({ kind: unit.kind })
				.from(unit)
				.where(eq(unit.id, params.unitId))
				.limit(1);
			if (!target) throw new UnitNotFound();
			return {
				unitId: params.unitId,
				scope,
				decisions: await Promise.all(
					unitPermissionsForKind(target.kind).map(async (permission) => ({
						permission,
						decision: await authorization.unit.decide(params.unitId, permission, scope),
					})),
				),
			};
		},
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
	)
	.get(
		"/:unitId/ownership/candidates",
		async ({ authorization, params, query }) => {
			await authorization.unit.ensure(params.unitId, "unit.ownership.transfer");
			const search = query.query?.trim();
			const limit = query.limit ?? 50;
			const rows = await database
				.select({
					profileId: profileTable.id,
					label: firstUnitLocalizationTitle(profileTable.id),
					slug: unitSlugAddress.slug,
				})
				.from(profileTable)
				.innerJoin(unit, eq(unit.id, profileTable.id))
				.leftJoin(
					unitSlugAddress,
					and(
						eq(unitSlugAddress.targetUnitId, profileTable.id),
						eq(unitSlugAddress.kind, "canonical"),
					),
				)
				.where(
					and(
						eligibleOwnershipCandidateCondition(params.unitId),
						query.cursor ? gt(profileTable.id, query.cursor) : undefined,
						search
							? or(
									sql`${profileTable.id}::text ilike ${`%${search}%`}`,
									sql`coalesce(${firstUnitLocalizationTitle(profileTable.id)}, '') ilike ${`%${search}%`}`,
									sql`coalesce(${unitSlugAddress.slug}, '') ilike ${`%${search}%`}`,
								)
							: undefined,
					),
				)
				.orderBy(profileTable.id)
				.limit(limit + 1);
			const items = rows.slice(0, limit);
			return {
				items,
				nextCursor: rows.length > limit ? (items.at(-1)?.profileId ?? null) : null,
			};
		},
		{
			access: "session-only",
			params: UnitGovernanceParams,
			query: ListUnitOwnershipCandidatesQuery,
			response: {
				[StatusCodes.OK]: UnitOwnershipCandidateListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitPermissionForbidden"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Search eligible Unit ownership recipients", tags: ["Governance"] },
		},
	)
	.put(
		"/:unitId/ownership",
		async ({ authorization, profile, params, body }) => {
			return database.transaction(async (tx) => {
				await lockUnitAccessState(tx, [params.unitId]);
				await authorization.unit.ensureInTransaction(
					tx,
					params.unitId,
					"unit.ownership.transfer",
				);
				if (body.expectedOwnerProfileId !== profile.unitId)
					throw new UnitOwnershipChanged();
				if (!(await isEligibleOwnershipCandidate(tx, params.unitId, body.targetProfileId)))
					throw new UnitOwnershipTargetIneligible();
				const now = new Date();
				const replaced = await replaceUnitOwnership(tx, {
					unitId: params.unitId,
					expectedOwnerProfileId: body.expectedOwnerProfileId,
					targetProfileId: body.targetProfileId,
					actorProfileId: profile.unitId,
					now,
				});
				if (!replaced.ok) {
					if (replaced.reason === "owner_unchanged")
						throw new UnitOwnershipTargetIneligible();
					throw new UnitOwnershipChanged();
				}
				await recordAccessAudit(tx, {
					actorProfileId: profile.unitId,
					action: "unit.ownership.transfer",
					unitId: params.unitId,
					metadata: {
						previousOwnerProfileId: replaced.previousOwnerProfileId,
						ownerProfileId: body.targetProfileId,
					},
				});
				const [owner] = await tx
					.select({
						profileId: profileTable.id,
						label: firstUnitLocalizationTitle(profileTable.id),
					})
					.from(profileTable)
					.where(eq(profileTable.id, body.targetProfileId))
					.limit(1);
				if (!owner) throw new UnitOwnershipTargetIneligible();
				return {
					owner,
				};
			});
		},
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
	)
	.post(
		"/:unitId/ownership/relinquishment",
		async ({ authorization, profile, params, body }) => {
			const result = await database.transaction(async (tx) => {
				await lockUnitAccessState(tx, [params.unitId]);
				await authorization.unit.ensureInTransaction(
					tx,
					params.unitId,
					"unit.ownership.transfer",
				);
				if (body.expectedOwnerProfileId !== profile.unitId)
					throw new UnitOwnershipChanged();
				if (body.expectedOwnerProfileId === OfficialProfileIds.community)
					throw new UnitOwnershipRelinquishmentForbidden();
				const now = new Date();
				const replaced = await replaceUnitOwnership(tx, {
					unitId: params.unitId,
					expectedOwnerProfileId: body.expectedOwnerProfileId,
					targetProfileId: OfficialProfileIds.community,
					actorProfileId: profile.unitId,
					now,
				});
				if (!replaced.ok) {
					if (replaced.reason === "owner_unchanged")
						throw new UnitOwnershipRelinquishmentForbidden();
					throw new UnitOwnershipChanged();
				}
				await recordAccessAudit(tx, {
					actorProfileId: profile.unitId,
					action: "unit.ownership.relinquish",
					unitId: params.unitId,
					metadata: {
						previousOwnerProfileId: replaced.previousOwnerProfileId,
						ownerProfileId: OfficialProfileIds.community,
					},
				});
				const [owner] = await tx
					.select({
						profileId: profileTable.id,
						label: firstUnitLocalizationTitle(profileTable.id),
					})
					.from(profileTable)
					.where(eq(profileTable.id, OfficialProfileIds.community))
					.limit(1);
				if (!owner) throw new ProfileNotFound();
				return {
					owner,
				};
			});
			return result;
		},
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
	);
