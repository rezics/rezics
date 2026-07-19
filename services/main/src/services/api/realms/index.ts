import { StatusCodes } from "http-status-codes";
import { and, desc, eq, inArray, max, notInArray, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import type { Authorization } from "../../authorization";
import { RealmRulesAcceptanceRequired } from "../../authorization/errors";
import {
	isRealmJoinable,
	isRealmVisible,
	type RealmCapability,
} from "../../authorization/realm/policy";
import { database } from "../../database";
import { fractionalPositionBetween } from "../../ordering/position";
import {
	isPrimaryUnitLocalization,
	makePrimaryUnitLocalization,
	primaryUnitTitle,
} from "../../units/localization";
import {
	auditEvent,
	moderationAction,
	moderationCase,
	profile as profileTable,
	realm,
	realmUnit,
	realmMember,
	realmPin,
	realmRule,
	realmRuleAcceptance,
	realmRuleRevision,
	unitFollow,
	unit,
	unitAccessBinding,
	unitLocalization,
} from "../../database/schema";
import { listGovernanceNotes } from "../../governance/note-service";
import { createNotification, deliverNotificationEmail } from "../../notifications/service";
import { findRealmMembership, getCurrentRealmRules } from "../../realms/service";
import type { DatabaseTransaction } from "../../database";
import { recordUnitRevision } from "../../units/history";
import { insertAddressedUnit } from "../../units/slug-address";
import { TopLevelSlugNamespaceUnitIds } from "../../units/slug-system";
import { generateSlugLabel } from "../../units/slug";
import {
	FollowResponse,
	IdResponse,
	MembershipResponse,
	NoContentResponse,
	RealmMemberListResponse,
	RealmMemberResponse,
	RealmPinListResponse,
	RealmPinResponse,
	RealmRuleRevisionResponse,
	RealmRulesResponse,
} from "../schema/action-response";
import {
	toApiErrorResponse,
	RealmDetailResponse,
	RealmListResponse,
	toPortableTextResponse,
} from "../schema/response";
import {
	CreateRealmBody,
	CreateRealmPinBody,
	JoinRealmBody,
	ListRealmMembersQuery,
	ListRealmUnitsQuery,
	ListRealmsQuery,
	ModerateRealmUnitBody,
	PublishRealmRulesBody,
	RealmUnitParams,
	RealmUnitListResponse,
	RealmUnitHistoryQuery,
	RealmUnitModerationHistoryResponse,
	RealmMemberParams,
	RealmParams,
	RealmPinParams,
	RemoveRealmPinQuery,
	UpdateRealmBody,
	UpdateRealmMemberBody,
} from "./schema";
import {
	executeAuthorizedModerationAction,
	loadModerationCaseForAction,
} from "../governance/moderation-service";
import { type CreateModerationActionBody, ModerationActionResponse } from "../governance/schema";
import {
	GovernanceReasonCodeValues,
	RealmUnitStatusValues,
} from "../../database/schema/contract-values";
import {
	RealmUnitNotFound,
	RealmMemberNotFound,
	RealmMembershipNotFound,
	RealmNotFound,
	RealmOwnerLeaveForbidden,
} from "./errors";

const RealmNotFoundResponse = toApiErrorResponse(["RealmNotFound"]);
const RealmMutationForbiddenResponse = toApiErrorResponse([
	"RealmCapabilityRequired",
	"UnitProtected",
]);

function presentRealmUnitStatus(value: string | null) {
	if (value === null) return null;
	const status = RealmUnitStatusValues.find((candidate) => candidate === value);
	if (!status) throw new Error("Realm moderation action has an invalid state outcome");
	return status;
}

function presentGovernanceReasonCode(value: string) {
	const reasonCode = GovernanceReasonCodeValues.find((candidate) => candidate === value);
	if (!reasonCode) throw new Error("Realm moderation action has an invalid reason code");
	return reasonCode;
}

async function ensureRealmFieldsAuthorized(
	authorization: Authorization<string>,
	realmId: string,
	capability: RealmCapability,
	scope: readonly string[],
): Promise<void> {
	await authorization.realm.ensureCapability(realmId, capability);
	await authorization.unit.ensureOperationAllowed(realmId, scope);
}

async function ensureRealmVisible(realmId: string, headers: Headers) {
	const [record] = await database
		.select({ status: unit.status, visibility: unit.visibility })
		.from(realm)
		.innerJoin(unit, eq(unit.id, realm.id))
		.where(eq(realm.id, realmId))
		.limit(1);
	if (!record) throw new RealmNotFound();
	const { profile } = await resolveIdentity(headers, "realm:read");
	const membership = profile ? await findRealmMembership(realmId, profile.unitId) : undefined;
	if (!isRealmVisible(record.status, record.visibility, membership?.state))
		throw new RealmNotFound();
	return profile;
}

async function recordAuditEvent(
	tx: DatabaseTransaction,
	actorProfileId: string,
	action: string,
	subjectId: string,
	metadata?: Record<string, unknown>,
) {
	await tx.insert(auditEvent).values({
		actorProfileId,
		action,
		decisionCode: "allowed",
		subjectKind: "unit",
		subjectId,
		metadata,
	});
}

export default new Elysia({ prefix: "/realms" })
	.use(session)
	.get(
		"",
		async ({ query }) => ({
			items: await database
				.select({
					id: realm.id,
					slug: unit.slug,
					joinPolicy: realm.joinPolicy,
					title: unitLocalization.title,
					summary: unitLocalization.summary,
					createdAt: unit.createdAt,
					updatedAt: unit.updatedAt,
				})
				.from(realm)
				.innerJoin(unit, eq(unit.id, realm.id))
				.leftJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, unit.id),
						isPrimaryUnitLocalization(unitLocalization.unitId),
					),
				)
				.where(and(eq(unit.status, "published"), eq(unit.visibility, "public")))
				.orderBy(desc(unit.createdAt), desc(unit.id))
				.limit(query.limit ?? 20),
		}),
		{
			query: ListRealmsQuery,
			response: { [StatusCodes.OK]: RealmListResponse },
			detail: { summary: "List Realms", tags: ["Realms"] },
		},
	)
	.post(
		"",
		async ({ profile, body }) => {
			const id = await database.transaction(async (tx) => {
				const created = await insertAddressedUnit(tx, {
					kind: "realm",
					slugScopeId: TopLevelSlugNamespaceUnitIds.realms,
					slug: body.slug,
					status: "published",
					visibility: body.visibility,
					publishedAt: new Date(),
				});
				await tx.insert(realm).values({ id: created.id, joinPolicy: body.joinPolicy });
				await tx.insert(unitLocalization).values({
					unitId: created.id,
					...body.localization,
				});
				await tx.insert(unitAccessBinding).values({
					unitId: created.id,
					subjectKind: "profile",
					profileId: profile.unitId,
					role: "owner",
					scope: [],
					grantedByProfileId: profile.unitId,
				});
				await tx.insert(realmMember).values({
					realmId: created.id,
					profileId: profile.unitId,
					role: "owner",
				});
				await tx.insert(unitFollow).values({
					followerProfileId: profile.unitId,
					unitId: created.id,
				});
				await recordUnitRevision(tx, {
					unitId: created.id,
					actorProfileId: profile.unitId,
					event: "create",
				});
				return created.id;
			});
			return { id };
		},
		{
			access: "contribute:unit:create",
			body: CreateRealmBody,
			response: { [StatusCodes.OK]: IdResponse },
			detail: { summary: "Create Realm", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId",
		async ({ params, request }) => {
			const viewer = await ensureRealmVisible(params.realmId, request.headers);
			const [record] = await database
				.select({
					id: realm.id,
					slug: unit.slug,
					status: unit.status,
					visibility: unit.visibility,
					joinPolicy: realm.joinPolicy,
					createdAt: unit.createdAt,
					updatedAt: unit.updatedAt,
				})
				.from(realm)
				.innerJoin(unit, eq(unit.id, realm.id))
				.where(eq(realm.id, params.realmId))
				.limit(1);
			if (!record) throw new RealmNotFound();
			const localizations = await database
				.select({
					language: unitLocalization.language,
					title: unitLocalization.title,
					summary: unitLocalization.summary,
				})
				.from(unitLocalization)
				.where(eq(unitLocalization.unitId, params.realmId))
				.orderBy(unitLocalization.position, unitLocalization.language);
			const [viewerMembership, subscriptions] = viewer
				? await Promise.all([
						findRealmMembership(params.realmId, viewer.unitId),
						database
							.select({ realmId: unitFollow.unitId })
							.from(unitFollow)
							.where(
								and(
									eq(unitFollow.followerProfileId, viewer.unitId),
									eq(unitFollow.unitId, params.realmId),
								),
							),
					])
				: [undefined, []];
			return {
				...record,
				language: localizations[0]?.language ?? null,
				localizations,
				viewerMembership: viewerMembership
					? { role: viewerMembership.role, state: viewerMembership.state }
					: undefined,
				viewerFollowing: subscriptions.length > 0,
			};
		},
		{
			params: RealmParams,
			response: {
				[StatusCodes.OK]: RealmDetailResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "Get Realm", tags: ["Realms"] },
		},
	)
	.patch(
		"/:realmId",
		async ({ params, profile, authorization, body }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.settings.update");
			for (const scope of [["unit"], ["realm"], ["localizations"]] as const)
				await authorization.unit.ensureOperationAllowed(params.realmId, scope);
			await database.transaction(async (tx) => {
				const updated = await tx
					.update(unit)
					.set({
						status: body.status,
						visibility: body.visibility,
						publishedAt: body.status === "published" ? new Date() : undefined,
					})
					.where(and(eq(unit.id, params.realmId), eq(unit.kind, "realm")))
					.returning({ id: unit.id });
				if (!updated.length) throw new RealmNotFound();
				if (body.joinPolicy)
					await tx
						.update(realm)
						.set({ joinPolicy: body.joinPolicy })
						.where(eq(realm.id, params.realmId));
				if (body.localization) {
					await tx
						.insert(unitLocalization)
						.values({ unitId: params.realmId, ...body.localization })
						.onConflictDoUpdate({
							target: [unitLocalization.unitId, unitLocalization.language],
							set: { ...body.localization },
						});
					await makePrimaryUnitLocalization(
						tx,
						params.realmId,
						body.localization.language,
					);
				}
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				await recordAuditEvent(tx, profile.unitId, "realm.settings.update", params.realmId);
			});
			return { id: params.realmId };
		},
		{
			access: "contribute:interaction:write",
			params: RealmParams,
			body: UpdateRealmBody,
			response: {
				[StatusCodes.OK]: IdResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "Update Realm", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/follow",
		async ({ params, profile, request }) => {
			await ensureRealmVisible(params.realmId, request.headers);
			await database
				.insert(unitFollow)
				.values({ followerProfileId: profile.unitId, unitId: params.realmId })
				.onConflictDoNothing();
			return { following: true };
		},
		{
			access: "write:interaction:write",
			params: RealmParams,
			response: {
				[StatusCodes.OK]: FollowResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "Follow Realm", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/follow",
		async ({ params, profile }) => {
			await database
				.delete(unitFollow)
				.where(
					and(
						eq(unitFollow.followerProfileId, profile.unitId),
						eq(unitFollow.unitId, params.realmId),
					),
				);
			return { following: false };
		},
		{
			access: "write:interaction:write",
			params: RealmParams,
			response: { [StatusCodes.OK]: FollowResponse },
			detail: { summary: "Unfollow Realm", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/membership",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureOperationAllowed(params.realmId, ["members"]);
			const [record] = await database
				.select({
					status: unit.status,
					visibility: unit.visibility,
					joinPolicy: realm.joinPolicy,
				})
				.from(realm)
				.innerJoin(unit, eq(unit.id, realm.id))
				.where(eq(realm.id, params.realmId))
				.limit(1);
			if (!record) throw new RealmNotFound();
			const current = await findRealmMembership(params.realmId, profile.unitId);
			if (!isRealmJoinable(record.status, record.visibility, current?.state))
				throw new RealmNotFound();
			const state = record.joinPolicy === "approval" ? "pending" : "active";
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.realmId}::text, 0))`,
				);
				const [rules] = await tx
					.select({
						id: realmRuleRevision.id,
						requireOnJoin: realmRuleRevision.requireOnJoin,
					})
					.from(realmRuleRevision)
					.where(eq(realmRuleRevision.realmId, params.realmId))
					.orderBy(desc(realmRuleRevision.version))
					.limit(1);
				if (rules?.requireOnJoin && rules.id !== body.ruleRevisionId)
					throw new RealmRulesAcceptanceRequired({ revisionId: rules.id });
				await tx
					.insert(realmMember)
					.values({ realmId: params.realmId, profileId: profile.unitId, state })
					.onConflictDoUpdate({
						target: [realmMember.realmId, realmMember.profileId],
						set: { state },
					});
				await tx
					.insert(unitFollow)
					.values({ followerProfileId: profile.unitId, unitId: params.realmId })
					.onConflictDoNothing();
				if (rules && rules.id === body.ruleRevisionId)
					await tx
						.insert(realmRuleAcceptance)
						.values({
							revisionId: rules.id,
							profileId: profile.unitId,
							language: body.language,
						})
						.onConflictDoNothing();
			});
			return { state };
		},
		{
			access: "contribute:interaction:write",
			params: RealmParams,
			body: JoinRealmBody,
			response: {
				[StatusCodes.OK]: MembershipResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitProtected"]),
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmRulesAcceptanceRequired"]),
			},
			detail: { summary: "Join Realm", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/membership",
		async ({ params, profile, authorization }) => {
			await authorization.unit.ensureOperationAllowed(params.realmId, ["members"]);
			await database.transaction(async (tx) => {
				const [membership] = await tx
					.select({ role: realmMember.role })
					.from(realmMember)
					.where(
						and(
							eq(realmMember.realmId, params.realmId),
							eq(realmMember.profileId, profile.unitId),
						),
					)
					.limit(1);
				if (!membership) throw new RealmMembershipNotFound();
				if (membership.role === "owner") throw new RealmOwnerLeaveForbidden();
				await tx
					.delete(realmMember)
					.where(
						and(
							eq(realmMember.realmId, params.realmId),
							eq(realmMember.profileId, profile.unitId),
						),
					);
				await tx
					.delete(unitFollow)
					.where(
						and(
							eq(unitFollow.followerProfileId, profile.unitId),
							eq(unitFollow.unitId, params.realmId),
						),
					);
				const revisions = tx
					.select({ id: realmRuleRevision.id })
					.from(realmRuleRevision)
					.where(eq(realmRuleRevision.realmId, params.realmId));
				await tx
					.delete(realmRuleAcceptance)
					.where(
						and(
							eq(realmRuleAcceptance.profileId, profile.unitId),
							inArray(realmRuleAcceptance.revisionId, revisions),
						),
					);
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "write:realm:manage",
			params: RealmParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitProtected"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmMembershipNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmOwnerLeaveForbidden"]),
			},
			detail: {
				summary: "Leave Realm",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/:realmId/members",
		async ({ params, authorization, query }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.members.read");
			return {
				items: await database
					.select({
						profileId: realmMember.profileId,
						name: primaryUnitTitle(profileTable.id),
						role: realmMember.role,
						state: realmMember.state,
						joinedAt: realmMember.joinedAt,
					})
					.from(realmMember)
					.innerJoin(profileTable, eq(profileTable.id, realmMember.profileId))
					.where(
						and(
							eq(realmMember.realmId, params.realmId),
							query.state ? eq(realmMember.state, query.state) : undefined,
						),
					)
					.orderBy(desc(realmMember.joinedAt), desc(realmMember.profileId))
					.limit(query.limit ?? 50),
			};
		},
		{
			access: "realm:read",
			params: RealmParams,
			query: ListRealmMembersQuery,
			response: {
				[StatusCodes.OK]: RealmMemberListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
			},
			detail: { summary: "List Realm members", tags: ["Realms"] },
		},
	)
	.patch(
		"/:realmId/members/:profileId",
		async ({ params, profile, authorization, body }) => {
			const actor = await authorization.realm.ensureMembershipCapability(
				params.realmId,
				"realm.members.manage",
			);
			await authorization.unit.ensureOperationAllowed(params.realmId, ["members"]);
			const target = await findRealmMembership(params.realmId, params.profileId);
			if (!target) throw new RealmMemberNotFound();
			authorization.realm.ensureCanManageMember(actor.role, target.role, body.role);
			const result = await database.transaction(async (tx) => {
				const [row] = await tx
					.update(realmMember)
					.set({ role: body.role, state: body.state })
					.where(
						and(
							eq(realmMember.realmId, params.realmId),
							eq(realmMember.profileId, params.profileId),
						),
					)
					.returning();
				if (!row) throw new RealmMemberNotFound();
				const notificationId = await createNotification(tx, {
					recipientProfileId: params.profileId,
					actorProfileId: profile.unitId,
					kind: "realm",
					subjectUnitId: params.realmId,
					payload: { type: "realm_event", event: "membership_updated" },
				});
				await recordAuditEvent(tx, profile.unitId, "realm.members.update", params.realmId, {
					profileId: params.profileId,
				});
				return { row, notificationId };
			});
			await deliverNotificationEmail(result.notificationId);
			return result.row;
		},
		{
			access: "contribute:realm:manage",
			params: RealmMemberParams,
			body: UpdateRealmMemberBody,
			response: {
				[StatusCodes.OK]: RealmMemberResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitProtected",
					"RealmRoleManagementForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmMemberNotFound"]),
			},
			detail: { summary: "Update Realm member", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/rules",
		async ({ params, profile, authorization, body }) => {
			await ensureRealmFieldsAuthorized(
				authorization,
				params.realmId,
				"realm.rules.publish",
				["rules"],
			);
			const revision = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.realmId}::text, 0))`,
				);
				const [latest] = await tx
					.select({ version: max(realmRuleRevision.version) })
					.from(realmRuleRevision)
					.where(eq(realmRuleRevision.realmId, params.realmId));
				const [created] = await tx
					.insert(realmRuleRevision)
					.values({
						realmId: params.realmId,
						version: Number(latest?.version ?? 0) + 1,
						requireOnJoin: body.requireOnJoin,
						requireOnPost: body.requireOnPost,
						requireOnUpdate: body.requireOnUpdate,
						createdByProfileId: profile.unitId,
					})
					.returning();
				if (!created) throw new Error("Realm rule revision insertion did not return a row");
				for (const [index, rule] of body.rules.entries()) {
					const ruleUnit = await insertAddressedUnit(tx, {
						kind: "realm_rule",
						slugScopeId: params.realmId,
						slug: generateSlugLabel(rule.title, "rule"),
						status: "published",
						visibility: "unlisted",
						publishedAt: new Date(),
					});
					await tx.insert(unitLocalization).values({
						unitId: ruleUnit.id,
						language: rule.language,
						title: rule.title,
						content: rule.content,
						contentStatus: "published",
					});
					await tx.insert(unitAccessBinding).values({
						unitId: ruleUnit.id,
						subjectKind: "profile",
						profileId: profile.unitId,
						role: "owner",
						scope: [],
						grantedByProfileId: profile.unitId,
					});
					await tx.insert(realmRule).values({
						id: ruleUnit.id,
						revisionId: created.id,
						position: index,
					});
				}
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				await recordAuditEvent(tx, profile.unitId, "realm.rules.publish", params.realmId);
				return created;
			});
			return { id: revision.id, version: revision.version };
		},
		{
			access: "write:realm:manage",
			params: RealmParams,
			body: PublishRealmRulesBody,
			response: {
				[StatusCodes.OK]: RealmRuleRevisionResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
			},
			detail: { summary: "Publish Realm rules", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/rules",
		async ({ params, request }) => {
			await ensureRealmVisible(params.realmId, request.headers);
			const current = await getCurrentRealmRules(params.realmId);
			if (!current)
				return {
					revisionId: null,
					version: null,
					requireOnJoin: false,
					requireOnPost: false,
					requireOnUpdate: false,
					items: [],
				};
			const items = await database
				.select({
					id: realmRule.id,
					position: realmRule.position,
					language: unitLocalization.language,
					title: unitLocalization.title,
					content: unitLocalization.content,
				})
				.from(realmRule)
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, realmRule.id),
						isPrimaryUnitLocalization(unitLocalization.unitId),
					),
				)
				.where(eq(realmRule.revisionId, current.revisionId))
				.orderBy(realmRule.position, realmRule.id);
			return {
				...current,
				items: items.map((item) => {
					if (!item.title)
						throw new Error(`Realm rule ${item.id} has no localized title`);
					return {
						...item,
						title: item.title,
						content: toPortableTextResponse(item.content),
					};
				}),
			};
		},
		{
			params: RealmParams,
			response: {
				[StatusCodes.OK]: RealmRulesResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "Get current Realm rules", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/pins",
		async ({ params, request }) => {
			await ensureRealmVisible(params.realmId, request.headers);
			return {
				items: await database
					.select({
						realmId: realmPin.realmId,
						unitId: realmPin.unitId,
						kind: realmPin.kind,
						position: realmPin.position,
						createdAt: realmPin.createdAt,
						updatedAt: realmPin.updatedAt,
					})
					.from(realmPin)
					.where(eq(realmPin.realmId, params.realmId))
					.orderBy(realmPin.kind, realmPin.position, realmPin.unitId),
			};
		},
		{
			params: RealmParams,
			response: {
				[StatusCodes.OK]: RealmPinListResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "List Realm pins", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/pins/:unitId",
		async ({ params, profile, authorization, body }) => {
			await ensureRealmFieldsAuthorized(authorization, params.realmId, "realm.pins.manage", [
				"pins",
			]);
			await authorization.unit.ensureCanRead(params.unitId);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.realmId}::text, 0))`,
				);
				const kind = body.kind ?? "pinned";
				const [last] = await tx
					.select({ position: realmPin.position })
					.from(realmPin)
					.where(and(eq(realmPin.realmId, params.realmId), eq(realmPin.kind, kind)))
					.orderBy(desc(realmPin.position), desc(realmPin.unitId))
					.limit(1);
				const position = body.position ?? fractionalPositionBetween(last?.position, null);
				const [entry] = await tx
					.insert(realmPin)
					.values({
						realmId: params.realmId,
						unitId: params.unitId,
						kind,
						position,
						createdByProfileId: profile.unitId,
					})
					.onConflictDoUpdate({
						target: [realmPin.realmId, realmPin.unitId],
						set: body.position === undefined ? { kind } : { kind, position },
					})
					.returning();
				if (!entry) throw new Error("Realm pin upsert did not return a row");
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				await recordAuditEvent(tx, profile.unitId, "realm.pins.upsert", params.unitId, {
					realmId: params.realmId,
				});
				return entry;
			});
		},
		{
			access: "contribute:realm:manage",
			params: RealmPinParams,
			body: CreateRealmPinBody,
			response: {
				[StatusCodes.OK]: RealmPinResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Pin Realm unit", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/pins/:unitId",
		async ({ params, profile, authorization, query }) => {
			await ensureRealmFieldsAuthorized(authorization, params.realmId, "realm.pins.manage", [
				"pins",
			]);
			await database.transaction(async (tx) => {
				const deleted = await tx
					.delete(realmPin)
					.where(
						and(
							eq(realmPin.realmId, params.realmId),
							eq(realmPin.unitId, params.unitId),
							query.kind ? eq(realmPin.kind, query.kind) : undefined,
						),
					)
					.returning({ unitId: realmPin.unitId });
				if (!deleted.length) return;
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				await recordAuditEvent(tx, profile.unitId, "realm.pins.delete", params.unitId, {
					realmId: params.realmId,
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "write:realm:manage",
			params: RealmPinParams,
			query: RemoveRealmPinQuery,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
			},
			detail: {
				summary: "Remove Realm pin",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/:realmId/units",
		async ({ params, query, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			return {
				items: await database
					.select({
						realmId: realmUnit.realmId,
						unitId: realmUnit.unitId,
						unitKind: unit.kind,
						title: primaryUnitTitle(unit.id),
						status: realmUnit.status,
						locked: realmUnit.locked,
						moderationStatus: unit.moderationStatus,
						createdAt: realmUnit.createdAt,
						updatedAt: realmUnit.updatedAt,
					})
					.from(realmUnit)
					.innerJoin(unit, eq(unit.id, realmUnit.unitId))
					.where(
						and(
							eq(realmUnit.realmId, params.realmId),
							query.status ? eq(realmUnit.status, query.status) : undefined,
						),
					)
					.orderBy(
						sql`case ${realmUnit.status} when 'pending' then 0 when 'hidden' then 1 when 'removed' then 2 else 3 end`,
						desc(realmUnit.updatedAt),
						desc(realmUnit.unitId),
					)
					.limit(query.limit ?? 50),
			};
		},
		{
			access: "session-only",
			params: RealmParams,
			query: ListRealmUnitsQuery,
			response: {
				[StatusCodes.OK]: RealmUnitListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
			},
			detail: { summary: "List Realm Units for moderation", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/units/:unitId/history",
		async ({ params, query, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			const [target] = await database
				.select({ unitId: realmUnit.unitId })
				.from(realmUnit)
				.where(
					and(eq(realmUnit.realmId, params.realmId), eq(realmUnit.unitId, params.unitId)),
				)
				.limit(1);
			if (!target) throw new RealmUnitNotFound();
			const actions = await database
				.select({
					id: moderationAction.id,
					caseId: moderationAction.caseId,
					kind: moderationAction.kind,
					actorProfileId: moderationAction.actorProfileId,
					actorName: primaryUnitTitle(profileTable.id),
					previousState: moderationAction.previousState,
					resultingState: moderationAction.resultingState,
					previousLocked: moderationAction.previousLocked,
					resultingLocked: moderationAction.resultingLocked,
					reasonCode: moderationAction.reasonCode,
					reversesActionId: moderationAction.reversesActionId,
					createdAt: moderationAction.createdAt,
				})
				.from(moderationAction)
				.innerJoin(moderationCase, eq(moderationCase.id, moderationAction.caseId))
				.leftJoin(profileTable, eq(profileTable.id, moderationAction.actorProfileId))
				.where(
					and(
						eq(moderationCase.authority, "realm"),
						eq(moderationCase.realmId, params.realmId),
						eq(moderationCase.targetKind, "realm_unit"),
						eq(moderationCase.targetId, params.unitId),
					),
				)
				.orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
				.limit(query.limit ?? 50);
			const actionIds = actions.map((action) => action.id);
			const notes = actionIds.length
				? await database.transaction((tx) =>
						listGovernanceNotes(tx, {
							subjectKind: "moderation_action",
							subjectIds: actionIds,
							roles: ["internal_note", "public_notice"],
						}),
					)
				: [];
			const notesByAction = new Map<
				string,
				Array<{
					postId: string;
					revisionId: string;
					role: "internal_note" | "public_notice";
					language: string;
					content: ReturnType<typeof toPortableTextResponse>;
					createdAt: Date;
				}>
			>();
			for (const note of notes) {
				if (note.role === "evidence") continue;
				const items = notesByAction.get(note.subjectId) ?? [];
				items.push({
					postId: note.postId,
					revisionId: note.revisionId,
					role: note.role,
					language: note.language,
					content: toPortableTextResponse(note.content),
					createdAt: note.createdAt,
				});
				notesByAction.set(note.subjectId, items);
			}
			return {
				items: actions.map((action) => ({
					...action,
					previousState: presentRealmUnitStatus(action.previousState),
					resultingState: presentRealmUnitStatus(action.resultingState),
					reasonCode: presentGovernanceReasonCode(action.reasonCode),
					notes: notesByAction.get(action.id) ?? [],
				})),
			};
		},
		{
			access: "session-only",
			params: RealmUnitParams,
			query: RealmUnitHistoryQuery,
			response: {
				[StatusCodes.OK]: RealmUnitModerationHistoryResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmUnitNotFound"]),
			},
			detail: { summary: "Get Realm Unit moderation history", tags: ["Realms"] },
		},
	)
	.patch(
		"/:realmId/units/:unitId",
		async ({ params, profile, authorization, body }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			const result = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(concat(${params.realmId}, ':', ${params.unitId}), 0))`,
				);
				const [target] = await tx
					.select({ unitId: realmUnit.unitId })
					.from(realmUnit)
					.where(
						and(
							eq(realmUnit.realmId, params.realmId),
							eq(realmUnit.unitId, params.unitId),
						),
					)
					.limit(1);
				if (!target) throw new RealmUnitNotFound();
				const [idempotentAction] = body.idempotencyKey
					? await tx
							.select({ caseId: moderationAction.caseId })
							.from(moderationAction)
							.innerJoin(
								moderationCase,
								eq(moderationCase.id, moderationAction.caseId),
							)
							.where(
								and(
									eq(moderationAction.actorProfileId, profile.unitId),
									eq(moderationAction.idempotencyKey, body.idempotencyKey),
									eq(moderationCase.authority, "realm"),
									eq(moderationCase.realmId, params.realmId),
									eq(moderationCase.targetKind, "realm_unit"),
									eq(moderationCase.targetId, params.unitId),
								),
							)
							.orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
							.limit(1)
					: [];
				let caseRow = idempotentAction
					? await loadModerationCaseForAction(tx, idempotentAction.caseId)
					: undefined;
				if (!caseRow) {
					const [candidate] = await tx
						.select({ id: moderationCase.id })
						.from(moderationCase)
						.where(
							and(
								eq(moderationCase.authority, "realm"),
								eq(moderationCase.realmId, params.realmId),
								eq(moderationCase.targetKind, "realm_unit"),
								eq(moderationCase.targetId, params.unitId),
								notInArray(moderationCase.state, [
									"resolved",
									"duplicate",
									"rejected",
								]),
							),
						)
						.orderBy(desc(moderationCase.updatedAt), desc(moderationCase.id))
						.limit(1);
					caseRow = candidate
						? await loadModerationCaseForAction(tx, candidate.id)
						: undefined;
				}
				if (!caseRow) {
					const [createdCase] = await tx
						.insert(moderationCase)
						.values({
							state: "reviewing",
							authority: "realm",
							realmId: params.realmId,
							targetKind: "realm_unit",
							targetId: params.unitId,
						})
						.returning();
					if (!createdCase)
						throw new Error("Realm moderation case insertion did not return a row");
					caseRow = createdCase;
				}
				const common = {
					caseId: caseRow.id,
					reasonCode: body.reasonCode,
					idempotencyKey: body.idempotencyKey,
				};
				const actionBody: CreateModerationActionBody =
					body.command === "note"
						? { ...common, kind: "note", notes: [body.annotation] }
						: {
								...common,
								kind: body.command,
								...(body.annotation ? { notes: [body.annotation] } : {}),
							};
				return executeAuthorizedModerationAction(tx, {
					caseRow,
					actorProfileId: profile.unitId,
					body: actionBody,
				});
			});
			await Promise.all(result.notificationIds.map(deliverNotificationEmail));
			return result.created;
		},
		{
			access: "contribute:unit:update",
			params: RealmUnitParams,
			body: ModerateRealmUnitBody,
			response: {
				[StatusCodes.OK]: ModerationActionResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ModerationActionIncompatible"]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmUnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"ModerationTransitionInvalid",
					"ModerationActionNoEffect",
					"ModerationIdempotencyConflict",
				]),
			},
			detail: { summary: "Apply Realm Unit moderation command", tags: ["Realms"] },
		},
	);
