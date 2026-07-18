import { StatusCodes } from "http-status-codes";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
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
import { defaultUnitTitle } from "../../database/localization";
import {
	auditEvent,
	profile as profileTable,
	realm,
	realmUnit,
	realmUnitStatusEvent,
	realmMember,
	realmPin,
	realmRule,
	realmRuleAcceptance,
	realmRuleRevision,
	realmSubscription,
	unit,
	unitCollaborator,
	unitLocalization,
} from "../../database/schema";
import { createNotification, deliverNotificationEmail } from "../../notifications/service";
import { findRealmMembership, getCurrentRealmRules } from "../../realms/service";
import type { DatabaseTransaction } from "../../database";
import { recordUnitRevision } from "../../units/history";
import {
	FollowResponse,
	IdResponse,
	MembershipResponse,
	NoContentResponse,
	RealmUnitResponse,
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
	ListRealmsQuery,
	ModerateRealmUnitBody,
	PublishRealmRulesBody,
	RealmUnitParams,
	RealmMemberParams,
	RealmParams,
	RealmPinParams,
	RemoveRealmPinQuery,
	UpdateRealmBody,
	UpdateRealmMemberBody,
} from "./schema";
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
	"UnitFieldLocked",
]);

async function ensureRealmFieldsAuthorized(
	authorization: Authorization<string>,
	realmId: string,
	capability: RealmCapability,
	path: string,
): Promise<void> {
	await authorization.realm.ensureCapability(realmId, capability);
	await authorization.unit.ensureFieldsUnlocked(realmId, [path]);
}

async function ensureRealmVisible(realmId: string, headers: Headers) {
	const [record] = await database
		.select({ status: unit.status, visibility: unit.visibility })
		.from(realm)
		.innerJoin(unit, eq(unit.id, realm.id))
		.where(eq(realm.id, realmId))
		.limit(1);
	if (!record) throw new RealmNotFound();
	const { profile } = await resolveIdentity(headers);
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
	reason: string,
	metadata?: Record<string, unknown>,
) {
	await tx.insert(auditEvent).values({
		actorProfileId,
		action,
		decisionCode: "allowed",
		reason,
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
					and(eq(unitLocalization.unitId, unit.id), eq(unitLocalization.isDefault, true)),
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
				const [created] = await tx
					.insert(unit)
					.values({
						kind: "realm",
						slug: body.slug,
						status: "published",
						visibility: body.visibility,
						publishedAt: new Date(),
					})
					.returning({ id: unit.id });
				if (!created) throw new Error("Realm insertion did not return an id");
				await tx.insert(realm).values({ id: created.id, joinPolicy: body.joinPolicy });
				await tx.insert(unitLocalization).values({
					unitId: created.id,
					...body.localization,
					isDefault: true,
				});
				await tx.insert(unitCollaborator).values({
					unitId: created.id,
					profileId: profile.unitId,
					role: "owner",
					addedByProfileId: profile.unitId,
				});
				await tx.insert(realmMember).values({
					realmId: created.id,
					profileId: profile.unitId,
					role: "owner",
				});
				await tx.insert(realmSubscription).values({
					profileId: profile.unitId,
					realmId: created.id,
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
			contribute: true,
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
					isDefault: unitLocalization.isDefault,
				})
				.from(unitLocalization)
				.where(eq(unitLocalization.unitId, params.realmId))
				.orderBy(desc(unitLocalization.isDefault), unitLocalization.language);
			const [viewerMembership, subscriptions] = viewer
				? await Promise.all([
						findRealmMembership(params.realmId, viewer.unitId),
						database
							.select({ realmId: realmSubscription.realmId })
							.from(realmSubscription)
							.where(
								and(
									eq(realmSubscription.profileId, viewer.unitId),
									eq(realmSubscription.realmId, params.realmId),
								),
							),
					])
				: [undefined, []];
			return {
				...record,
				language: localizations.find(({ isDefault }) => isDefault)?.language ?? null,
				localizations: localizations.map(({ isDefault: _isDefault, ...item }) => item),
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
			await authorization.unit.ensureFieldsUnlocked(params.realmId, [
				"/unit",
				"/realm",
				"/localizations",
			]);
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
						.update(unitLocalization)
						.set({ isDefault: false })
						.where(eq(unitLocalization.unitId, params.realmId));
					await tx
						.insert(unitLocalization)
						.values({ unitId: params.realmId, ...body.localization, isDefault: true })
						.onConflictDoUpdate({
							target: [unitLocalization.unitId, unitLocalization.language],
							set: { ...body.localization, isDefault: true },
						});
				}
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				await recordAuditEvent(
					tx,
					profile.unitId,
					"realm.settings.update",
					params.realmId,
					"Realm settings updated",
				);
			});
			return { id: params.realmId };
		},
		{
			contribute: true,
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
				.insert(realmSubscription)
				.values({ profileId: profile.unitId, realmId: params.realmId })
				.onConflictDoNothing();
			return { following: true };
		},
		{
			write: true,
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
				.delete(realmSubscription)
				.where(
					and(
						eq(realmSubscription.profileId, profile.unitId),
						eq(realmSubscription.realmId, params.realmId),
					),
				);
			return { following: false };
		},
		{
			write: true,
			params: RealmParams,
			response: { [StatusCodes.OK]: FollowResponse },
			detail: { summary: "Unfollow Realm", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/membership",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureFieldsUnlocked(params.realmId, ["/members"]);
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
					.insert(realmSubscription)
					.values({ profileId: profile.unitId, realmId: params.realmId })
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
			contribute: true,
			params: RealmParams,
			body: JoinRealmBody,
			response: {
				[StatusCodes.OK]: MembershipResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitFieldLocked"]),
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmRulesAcceptanceRequired"]),
			},
			detail: { summary: "Join Realm", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/membership",
		async ({ params, profile, authorization }) => {
			await authorization.unit.ensureFieldsUnlocked(params.realmId, ["/members"]);
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
					.delete(realmSubscription)
					.where(
						and(
							eq(realmSubscription.profileId, profile.unitId),
							eq(realmSubscription.realmId, params.realmId),
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
			write: true,
			params: RealmParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitFieldLocked"]),
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
						name: defaultUnitTitle(profileTable.id),
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
			auth: true,
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
			await authorization.unit.ensureFieldsUnlocked(params.realmId, ["/members"]);
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
					payload: { event: "membership_updated" },
				});
				await recordAuditEvent(
					tx,
					profile.unitId,
					"realm.members.update",
					params.realmId,
					"Realm member updated",
					{
						profileId: params.profileId,
					},
				);
				return { row, notificationId };
			});
			await deliverNotificationEmail(result.notificationId);
			return result.row;
		},
		{
			contribute: true,
			params: RealmMemberParams,
			body: UpdateRealmMemberBody,
			response: {
				[StatusCodes.OK]: RealmMemberResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitFieldLocked",
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
				"/rules",
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
					const [ruleUnit] = await tx
						.insert(unit)
						.values({
							kind: "realm_rule",
							status: "published",
							visibility: "unlisted",
							publishedAt: new Date(),
						})
						.returning({ id: unit.id });
					if (!ruleUnit)
						throw new Error("Realm rule Unit insertion did not return an id");
					await tx.insert(unitLocalization).values({
						unitId: ruleUnit.id,
						language: rule.language,
						isDefault: true,
						title: rule.title,
						content: rule.content,
						contentStatus: "published",
					});
					await tx.insert(unitCollaborator).values({
						unitId: ruleUnit.id,
						profileId: profile.unitId,
						role: "owner",
						addedByProfileId: profile.unitId,
					});
					await tx.insert(realmRule).values({
						id: ruleUnit.id,
						revisionId: created.id,
						position: String(index).padStart(8, "0"),
					});
				}
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				await recordAuditEvent(
					tx,
					profile.unitId,
					"realm.rules.publish",
					params.realmId,
					"Realm rules published",
				);
				return created;
			});
			return { id: revision.id, version: revision.version };
		},
		{
			write: true,
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
						eq(unitLocalization.isDefault, true),
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
			await ensureRealmFieldsAuthorized(
				authorization,
				params.realmId,
				"realm.pins.manage",
				"/pins",
			);
			await authorization.unit.ensureCanRead(params.unitId);
			return database.transaction(async (tx) => {
				const [entry] = await tx
					.insert(realmPin)
					.values({
						realmId: params.realmId,
						unitId: params.unitId,
						kind: body.kind ?? "pinned",
						position: body.position ?? "V",
						createdByProfileId: profile.unitId,
					})
					.onConflictDoUpdate({
						target: [realmPin.realmId, realmPin.unitId],
						set: { kind: body.kind ?? "pinned", position: body.position ?? "V" },
					})
					.returning();
				if (!entry) throw new Error("Realm pin upsert did not return a row");
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				await recordAuditEvent(
					tx,
					profile.unitId,
					"realm.pins.upsert",
					params.unitId,
					"Realm pin updated",
					{
						realmId: params.realmId,
					},
				);
				return entry;
			});
		},
		{
			contribute: true,
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
			await ensureRealmFieldsAuthorized(
				authorization,
				params.realmId,
				"realm.pins.manage",
				"/pins",
			);
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
				await recordAuditEvent(
					tx,
					profile.unitId,
					"realm.pins.delete",
					params.unitId,
					"Realm pin removed",
					{
						realmId: params.realmId,
					},
				);
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			write: true,
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
	.patch(
		"/:realmId/units/:unitId",
		async ({ params, profile, authorization, body }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			const result = await database.transaction(async (tx) => {
				const [current] = await tx
					.select({
						status: realmUnit.status,
					})
					.from(realmUnit)
					.where(
						and(
							eq(realmUnit.realmId, params.realmId),
							eq(realmUnit.unitId, params.unitId),
						),
					)
					.limit(1);
				if (!current) throw new RealmUnitNotFound();
				const status = "status" in body ? body.status : undefined;
				const annotationDocument = "status" in body ? body.annotationDocument : undefined;
				const [row] = await tx
					.update(realmUnit)
					.set({ status, locked: body.locked })
					.where(
						and(
							eq(realmUnit.realmId, params.realmId),
							eq(realmUnit.unitId, params.unitId),
						),
					)
					.returning();
				if (!row) throw new RealmUnitNotFound();
				if (status && status !== current.status)
					await tx.insert(realmUnitStatusEvent).values({
						realmId: params.realmId,
						unitId: params.unitId,
						fromStatus: current.status,
						toStatus: status,
						changedByProfileId: profile.unitId,
						annotationDocument,
					});
				const owners = await tx
					.select({ profileId: unitCollaborator.profileId })
					.from(unitCollaborator)
					.where(
						and(
							eq(unitCollaborator.unitId, params.unitId),
							eq(unitCollaborator.role, "owner"),
						),
					);
				const notificationIds = await Promise.all(
					owners.map(({ profileId }) =>
						createNotification(tx, {
							recipientProfileId: profileId,
							actorProfileId: profile.unitId,
							kind: "moderation",
							subjectUnitId: params.unitId,
							payload: { realmId: params.realmId, status: row.status },
						}),
					),
				);
				await recordAuditEvent(
					tx,
					profile.unitId,
					"realm.units.moderate",
					params.unitId,
					"Realm Unit moderation updated",
					{
						realmId: params.realmId,
						status: row.status,
					},
				);
				return { row, notificationIds };
			});
			await Promise.all(result.notificationIds.map(deliverNotificationEmail));
			return result.row;
		},
		{
			contribute: true,
			params: RealmUnitParams,
			body: ModerateRealmUnitBody,
			response: {
				[StatusCodes.OK]: RealmUnitResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmUnitNotFound"]),
			},
			detail: { summary: "Update Realm Unit status", tags: ["Realms"] },
		},
	);
