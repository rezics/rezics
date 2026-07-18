import { StatusCodes } from "http-status-codes";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import type { Authorization } from "../../authorization";
import { database } from "../../database";
import type { DatabaseTransaction } from "../../database";
import {
	auditEvent,
	profile as profileTable,
	realm,
	unitAccessBinding,
	unitAccessRestriction,
	unitProtection,
} from "../../database/schema";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import { RealmNotFound } from "../realms/errors";
import { ProfileNotFound } from "../users/errors";
import {
	CreateUnitAccessBindingBody,
	CreateUnitAccessRestrictionBody,
	CreateUnitProtectionBody,
	UnitEffectiveAccessQuery,
	UnitEffectiveAccessResponse,
	UnitAccessBindingListResponse,
	UnitAccessBindingParams,
	UnitAccessBindingResponse,
	UnitAccessRestrictionListResponse,
	UnitAccessRestrictionParams,
	UnitAccessRestrictionResponse,
	UnitGovernanceParams,
	UnitProtectionListResponse,
	UnitProtectionParams,
	UnitProtectionResponse,
} from "./schema";
import {
	UnitAccessBindingConflict,
	UnitAccessBindingNotFound,
	UnitAccessExpiryInvalid,
	UnitAccessRestrictionConflict,
	UnitAccessRestrictionNotFound,
	UnitAccessSubjectRoleInvalid,
	UnitOwnerRequired,
	UnitOwnerRestrictionForbidden,
	UnitProtectionNotFound,
} from "./errors";
import { UnitPermissionValues } from "../../database/schema/contract-values";

const UnitGovernanceForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitAccessRestricted",
	"PlatformCapabilityRequired",
]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

function active(
	revokedAt: typeof unitAccessBinding.revokedAt,
	expiresAt: typeof unitAccessBinding.expiresAt,
) {
	return and(isNull(revokedAt), or(isNull(expiresAt), sql`${expiresAt} > now()`));
}

function parseExpiry(value: string | undefined): Date | null {
	if (!value) return null;
	const expiresAt = new Date(value);
	if (expiresAt <= new Date()) throw new UnitAccessExpiryInvalid();
	return expiresAt;
}

async function ensureOwnerOrPlatform(
	authorization: Authorization<string>,
	unitId: string,
): Promise<void> {
	const decision = await authorization.unit.decide(unitId, "unit.access.manage");
	if (decision.allowed && decision.source === "platform") return;
	if (decision.allowed && decision.source === "binding" && decision.role === "owner") return;
	await authorization.platform.ensureCapability("unit.edit");
}

async function ensureSubjectExists(
	subject: typeof CreateUnitAccessBindingBody.static.subject,
): Promise<void> {
	if (subject.kind === "profile") {
		const [profile] = await database
			.select({ id: profileTable.id })
			.from(profileTable)
			.where(eq(profileTable.id, subject.profileId))
			.limit(1);
		if (!profile) throw new ProfileNotFound();
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
		actorProfileId: string;
		action: string;
		unitId: string;
		reason: string;
		metadata?: Record<string, unknown>;
	},
) {
	await tx.insert(auditEvent).values({
		actorProfileId: input.actorProfileId,
		action: input.action,
		decisionCode: "allowed",
		reason: input.reason,
		subjectKind: "unit",
		subjectId: input.unitId,
		metadata: input.metadata,
	});
}

export default new Elysia({ prefix: "/unit" })
	.use(session)
	.get(
		"/:unitId/access/effective",
		async ({ authorization, params, query }) => {
			const scope = query.scope ?? [];
			return {
				unitId: params.unitId,
				scope,
				decisions: await Promise.all(
					UnitPermissionValues.map(async (permission) => ({
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
		"/:unitId/access-bindings",
		async ({ authorization, params }) => {
			await authorization.unit.ensure(params.unitId, "unit.access.manage");
			return {
				items: await database
					.select()
					.from(unitAccessBinding)
					.where(
						and(
							eq(unitAccessBinding.unitId, params.unitId),
							isNull(unitAccessBinding.revokedAt),
						),
					)
					.orderBy(unitAccessBinding.scope, unitAccessBinding.role, unitAccessBinding.id),
			};
		},
		{
			access: "session-only",
			params: UnitGovernanceParams,
			response: {
				[StatusCodes.OK]: UnitAccessBindingListResponse,
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "List Unit access bindings", tags: ["Governance"] },
		},
	)
	.post(
		"/:unitId/access-bindings",
		async ({ authorization, profile, params, body }) => {
			await authorization.unit.ensure(params.unitId, "unit.access.manage", body.scope);
			if (
				body.subject.kind === "authenticated" &&
				body.role !== "viewer" &&
				body.role !== "editor"
			)
				throw new UnitAccessSubjectRoleInvalid();
			if (body.role === "owner" || body.role === "maintainer")
				await ensureOwnerOrPlatform(authorization, params.unitId);
			await ensureSubjectExists(body.subject);
			const expiresAt = parseExpiry(body.expiresAt);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`unit-access:${params.unitId}`}::text, 0))`,
				);
				const subjectCondition =
					body.subject.kind === "profile"
						? and(
								eq(unitAccessBinding.subjectKind, "profile"),
								eq(unitAccessBinding.profileId, body.subject.profileId),
							)
						: body.subject.kind === "realm"
							? and(
									eq(unitAccessBinding.subjectKind, "realm"),
									eq(unitAccessBinding.realmId, body.subject.realmId),
									eq(unitAccessBinding.realmRelation, body.subject.relation),
								)
							: eq(unitAccessBinding.subjectKind, "authenticated");
				const [duplicate] = await tx
					.select({ id: unitAccessBinding.id })
					.from(unitAccessBinding)
					.where(
						and(
							eq(unitAccessBinding.unitId, params.unitId),
							subjectCondition,
							eq(unitAccessBinding.scope, body.scope),
							isNull(unitAccessBinding.revokedAt),
						),
					)
					.limit(1);
				if (duplicate) throw new UnitAccessBindingConflict();
				const subjectColumns =
					body.subject.kind === "profile"
						? { subjectKind: "profile" as const, profileId: body.subject.profileId }
						: body.subject.kind === "realm"
							? {
									subjectKind: "realm" as const,
									realmId: body.subject.realmId,
									realmRelation: body.subject.relation,
								}
							: { subjectKind: "authenticated" as const };
				const [created] = await tx
					.insert(unitAccessBinding)
					.values({
						unitId: params.unitId,
						...subjectColumns,
						role: body.role,
						scope: body.scope,
						expiresAt,
						grantedByProfileId: profile.unitId,
					})
					.returning();
				if (!created) throw new Error("Unit access binding insertion returned no row");
				await recordAccessAudit(tx, {
					actorProfileId: profile.unitId,
					action: "unit.access_binding.create",
					unitId: params.unitId,
					reason: `Granted ${body.role} at ${body.scope.join("/") || "root"}`,
					metadata: { bindingId: created.id, subjectKind: body.subject.kind },
				});
				return created;
			});
		},
		{
			access: "session-only",
			params: UnitGovernanceParams,
			body: CreateUnitAccessBindingBody,
			response: {
				[StatusCodes.OK]: UnitAccessBindingResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"UnitAccessExpiryInvalid",
					"UnitAccessSubjectRoleInvalid",
				]),
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ProfileNotFound",
					"RealmNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitAccessBindingConflict"]),
			},
			detail: { summary: "Create Unit access binding", tags: ["Governance"] },
		},
	)
	.delete(
		"/:unitId/access-bindings/:bindingId",
		async ({ authorization, profile, params }) => {
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`unit-access:${params.unitId}`}::text, 0))`,
				);
				const [target] = await tx
					.select({
						id: unitAccessBinding.id,
						role: unitAccessBinding.role,
						scope: unitAccessBinding.scope,
						expiresAt: unitAccessBinding.expiresAt,
					})
					.from(unitAccessBinding)
					.where(
						and(
							eq(unitAccessBinding.id, params.bindingId),
							eq(unitAccessBinding.unitId, params.unitId),
							isNull(unitAccessBinding.revokedAt),
						),
					)
					.limit(1);
				if (!target) throw new UnitAccessBindingNotFound();
				await authorization.unit.ensure(params.unitId, "unit.access.manage", target.scope);
				if (
					target.role === "owner" &&
					(!target.expiresAt || target.expiresAt > new Date())
				) {
					await ensureOwnerOrPlatform(authorization, params.unitId);
					const owners = await tx
						.select({ id: unitAccessBinding.id })
						.from(unitAccessBinding)
						.where(
							and(
								eq(unitAccessBinding.unitId, params.unitId),
								eq(unitAccessBinding.role, "owner"),
								active(unitAccessBinding.revokedAt, unitAccessBinding.expiresAt),
							),
						);
					if (owners.length <= 1) throw new UnitOwnerRequired();
				}
				await tx
					.update(unitAccessBinding)
					.set({ revokedAt: new Date(), revokedByProfileId: profile.unitId })
					.where(eq(unitAccessBinding.id, target.id));
				await recordAccessAudit(tx, {
					actorProfileId: profile.unitId,
					action: "unit.access_binding.revoke",
					unitId: params.unitId,
					reason: "Unit access binding revoked",
					metadata: { bindingId: target.id },
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "session-only",
			params: UnitAccessBindingParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"UnitAccessBindingNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitOwnerRequired"]),
			},
			detail: {
				summary: "Revoke Unit access binding",
				tags: ["Governance"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/:unitId/access-restrictions",
		async ({ authorization, params }) => {
			await authorization.unit.ensure(params.unitId, "unit.access.manage");
			return {
				items: await database
					.select()
					.from(unitAccessRestriction)
					.where(
						and(
							eq(unitAccessRestriction.unitId, params.unitId),
							isNull(unitAccessRestriction.revokedAt),
						),
					)
					.orderBy(unitAccessRestriction.scope, unitAccessRestriction.permission),
			};
		},
		{
			access: "session-only",
			params: UnitGovernanceParams,
			response: {
				[StatusCodes.OK]: UnitAccessRestrictionListResponse,
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "List Unit access restrictions", tags: ["Governance"] },
		},
	)
	.post(
		"/:unitId/access-restrictions",
		async ({ authorization, profile, params, body }) => {
			await authorization.unit.ensure(params.unitId, "unit.access.manage", body.scope);
			const expiresAt = parseExpiry(body.expiresAt);
			const [targetProfile] = await database
				.select({ id: profileTable.id })
				.from(profileTable)
				.where(eq(profileTable.id, body.profileId))
				.limit(1);
			if (!targetProfile) throw new ProfileNotFound();
			const [created] = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`unit-access:${params.unitId}`}::text, 0))`,
				);
				const [owner] = await tx
					.select({ id: unitAccessBinding.id })
					.from(unitAccessBinding)
					.where(
						and(
							eq(unitAccessBinding.unitId, params.unitId),
							eq(unitAccessBinding.subjectKind, "profile"),
							eq(unitAccessBinding.profileId, body.profileId),
							eq(unitAccessBinding.role, "owner"),
							active(unitAccessBinding.revokedAt, unitAccessBinding.expiresAt),
						),
					)
					.limit(1);
				if (owner) throw new UnitOwnerRestrictionForbidden();
				const [duplicate] = await tx
					.select({ id: unitAccessRestriction.id })
					.from(unitAccessRestriction)
					.where(
						and(
							eq(unitAccessRestriction.unitId, params.unitId),
							eq(unitAccessRestriction.profileId, body.profileId),
							eq(unitAccessRestriction.permission, body.permission),
							eq(unitAccessRestriction.scope, body.scope),
							isNull(unitAccessRestriction.revokedAt),
						),
					)
					.limit(1);
				if (duplicate) throw new UnitAccessRestrictionConflict();
				const rows = await tx
					.insert(unitAccessRestriction)
					.values({
						unitId: params.unitId,
						profileId: body.profileId,
						permission: body.permission,
						scope: body.scope,
						reason: body.reason,
						expiresAt,
						createdByProfileId: profile.unitId,
					})
					.returning();
				await recordAccessAudit(tx, {
					actorProfileId: profile.unitId,
					action: "unit.access_restriction.create",
					unitId: params.unitId,
					reason: body.reason,
					metadata: { restrictionId: rows[0]?.id, targetProfileId: body.profileId },
				});
				return rows;
			});
			if (!created) throw new Error("Unit access restriction insertion returned no row");
			return created;
		},
		{
			access: "session-only",
			params: UnitGovernanceParams,
			body: CreateUnitAccessRestrictionBody,
			response: {
				[StatusCodes.OK]: UnitAccessRestrictionResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["UnitAccessExpiryInvalid"]),
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ProfileNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitOwnerRestrictionForbidden",
					"UnitAccessRestrictionConflict",
				]),
			},
			detail: { summary: "Restrict Profile access to a Unit scope", tags: ["Governance"] },
		},
	)
	.delete(
		"/:unitId/access-restrictions/:restrictionId",
		async ({ authorization, profile, params }) => {
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`unit-access:${params.unitId}`}::text, 0))`,
				);
				const [target] = await tx
					.select({ id: unitAccessRestriction.id, scope: unitAccessRestriction.scope })
					.from(unitAccessRestriction)
					.where(
						and(
							eq(unitAccessRestriction.id, params.restrictionId),
							eq(unitAccessRestriction.unitId, params.unitId),
							isNull(unitAccessRestriction.revokedAt),
						),
					)
					.limit(1);
				if (!target) throw new UnitAccessRestrictionNotFound();
				await authorization.unit.ensure(params.unitId, "unit.access.manage", target.scope);
				await tx
					.update(unitAccessRestriction)
					.set({ revokedAt: new Date(), revokedByProfileId: profile.unitId })
					.where(eq(unitAccessRestriction.id, target.id));
				await recordAccessAudit(tx, {
					actorProfileId: profile.unitId,
					action: "unit.access_restriction.revoke",
					unitId: params.unitId,
					reason: "Unit access restriction revoked",
					metadata: { restrictionId: target.id },
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "session-only",
			params: UnitAccessRestrictionParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"UnitAccessRestrictionNotFound",
				]),
			},
			detail: {
				summary: "Revoke Unit access restriction",
				tags: ["Governance"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/:unitId/protections",
		async ({ authorization, params }) => {
			await authorization.unit.ensure(params.unitId, "unit.protection.manage");
			return {
				items: await database
					.select()
					.from(unitProtection)
					.where(
						and(
							eq(unitProtection.unitId, params.unitId),
							isNull(unitProtection.revokedAt),
						),
					)
					.orderBy(unitProtection.scope, unitProtection.id),
			};
		},
		{
			access: "session-only",
			params: UnitGovernanceParams,
			response: {
				[StatusCodes.OK]: UnitProtectionListResponse,
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "List Unit protections", tags: ["Governance"] },
		},
	)
	.post(
		"/:unitId/protections",
		async ({ authorization, profile, params, body }) => {
			await authorization.unit.ensure(params.unitId, "unit.protection.manage", body.scope);
			const expiresAt = parseExpiry(body.expiresAt);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`unit-protection:${params.unitId}`}::text, 0))`,
				);
				await tx
					.update(unitProtection)
					.set({ revokedAt: new Date(), revokedByProfileId: profile.unitId })
					.where(
						and(
							eq(unitProtection.unitId, params.unitId),
							eq(unitProtection.scope, body.scope),
							isNull(unitProtection.revokedAt),
						),
					);
				const [created] = await tx
					.insert(unitProtection)
					.values({
						unitId: params.unitId,
						scope: body.scope,
						mode: body.mode,
						reason: body.reason,
						expiresAt,
						createdByProfileId: profile.unitId,
					})
					.returning();
				if (!created) throw new Error("Unit protection insertion returned no row");
				await recordAccessAudit(tx, {
					actorProfileId: profile.unitId,
					action: "unit.protection.create",
					unitId: params.unitId,
					reason: body.reason,
					metadata: { protectionId: created.id, mode: body.mode, scope: body.scope },
				});
				return created;
			});
		},
		{
			access: "session-only",
			params: UnitGovernanceParams,
			body: CreateUnitProtectionBody,
			response: {
				[StatusCodes.OK]: UnitProtectionResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["UnitAccessExpiryInvalid"]),
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Protect Unit scope", tags: ["Governance"] },
		},
	)
	.delete(
		"/:unitId/protections/:protectionId",
		async ({ authorization, profile, params }) => {
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`unit-protection:${params.unitId}`}::text, 0))`,
				);
				const [target] = await tx
					.select({ id: unitProtection.id, scope: unitProtection.scope })
					.from(unitProtection)
					.where(
						and(
							eq(unitProtection.id, params.protectionId),
							eq(unitProtection.unitId, params.unitId),
							isNull(unitProtection.revokedAt),
						),
					)
					.limit(1);
				if (!target) throw new UnitProtectionNotFound();
				await authorization.unit.ensure(
					params.unitId,
					"unit.protection.manage",
					target.scope,
				);
				await tx
					.update(unitProtection)
					.set({ revokedAt: new Date(), revokedByProfileId: profile.unitId })
					.where(eq(unitProtection.id, target.id));
				await recordAccessAudit(tx, {
					actorProfileId: profile.unitId,
					action: "unit.protection.revoke",
					unitId: params.unitId,
					reason: "Unit protection revoked",
					metadata: { protectionId: target.id },
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "session-only",
			params: UnitProtectionParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: UnitGovernanceForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"UnitProtectionNotFound",
				]),
			},
			detail: {
				summary: "Revoke Unit protection",
				tags: ["Governance"],
				responses: NoContentResponse,
			},
		},
	);
