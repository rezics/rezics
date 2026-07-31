import { desc, eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";

import Elysia from "elysia";

import { recordAuditEvent } from "../../audit";
import {
	ApiQuotaAssignmentInvalid,
	assignApiTokenQuotaPolicy,
	assignApiAccountQuotaPolicy,
	listApiQuotaPolicies,
	resetApiTokenQuotaPolicy,
	resetApiAccountQuotaPolicy,
	resolveApiAccountQuotaPolicy,
	resolveApiTokenQuotaPolicy,
	reviseApiQuotaPolicy,
} from "../../auth/api-quota/policy-service";
import { ApiQuotaPolicyDocumentInvalid } from "../../auth/api-quota/policy-schema";
import session from "../../auth/session";
import { database, type DatabaseExecutor } from "../../database";
import { apikeys, apiQuotaPolicy, users } from "../../database/schema";
import { UserNotFound } from "../users/errors";
import { toApiErrorResponse } from "../schema/response";
import {
	ApiAccountQuotaRevisionConflict,
	ApiQuotaPolicyInvalid,
	ApiQuotaPolicyNotFound,
	ApiQuotaPolicyRevisionConflict,
	ApiTokenQuotaRevisionConflict,
} from "./errors";
import {
	ApiAccountTokenQuotaParams,
	ApiAccountQuotaParams,
	ApiAccountQuotaPolicyResponse,
	ApiQuotaPolicyListResponse,
	ApiQuotaPolicyParams,
	ApiQuotaPolicySummary,
	AssignApiTokenQuotaBody,
	AssignApiAccountQuotaBody,
	ManagedApiTokenQuotaListResponse,
	ResetApiTokenQuotaBody,
	ResetApiAccountQuotaBody,
	ReviseApiQuotaPolicyBody,
	ApiTokenQuotaPolicyResponse,
} from "./schema";

const AuthenticationResponse = toApiErrorResponse(["InteractiveSessionRequired"]);
const PlatformAccessResponse = toApiErrorResponse([
	"FreshSessionRequired",
	"PlatformCapabilityRequired",
]);
const PolicyNotFoundResponse = toApiErrorResponse(["ApiQuotaPolicyNotFound"]);
const PolicyInvalidResponse = toApiErrorResponse(["ApiQuotaPolicyInvalid"]);
const PolicyRevisionConflictResponse = toApiErrorResponse(["ApiQuotaPolicyRevisionConflict"]);
const AccountQuotaRevisionConflictResponse = toApiErrorResponse([
	"ApiAccountQuotaRevisionConflict",
]);
const TokenQuotaRevisionConflictResponse = toApiErrorResponse(["ApiTokenQuotaRevisionConflict"]);

function presentAccountQuota(policy: Awaited<ReturnType<typeof resolveApiAccountQuotaPolicy>>) {
	return {
		key: policy.key,
		class: policy.class,
		source: policy.source,
		schemaVersion: policy.schemaVersion,
		policyRevision: policy.policyRevision,
		bindingRevision: policy.bindingRevision,
		validUntil: policy.validUntil,
		assignmentReason: policy.assignmentReason,
		configurationOverride: policy.configurationOverride,
		limits: policy.configuration.limits,
		maxActiveTokens: policy.configuration.maxActiveTokens,
		operations: policy.configuration.operations,
	};
}

function presentTokenQuota(policy: Awaited<ReturnType<typeof resolveApiTokenQuotaPolicy>>) {
	return {
		key: policy.key,
		class: policy.class,
		source: policy.source,
		schemaVersion: policy.schemaVersion,
		policyRevision: policy.policyRevision,
		bindingRevision: policy.bindingRevision,
		validUntil: policy.validUntil,
		assignmentReason: policy.assignmentReason,
		configurationOverride: policy.configurationOverride,
		limits: policy.configuration.limits,
		operations: policy.configuration.operations,
	};
}

async function requireUser(executor: DatabaseExecutor, userId: string): Promise<void> {
	const [user] = await executor
		.select({ id: users.id })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	if (!user) throw new UserNotFound();
}

async function requireOwnedToken(executor: DatabaseExecutor, userId: string, tokenId: string) {
	const [token] = await executor
		.select({
			id: apikeys.id,
			userId: apikeys.referenceId,
			name: apikeys.name,
			start: apikeys.start,
			prefix: apikeys.prefix,
			enabled: apikeys.enabled,
			expiresAt: apikeys.expiresAt,
			lastUsedAt: apikeys.lastRequest,
			createdAt: apikeys.createdAt,
			updatedAt: apikeys.updatedAt,
		})
		.from(apikeys)
		.where(eq(apikeys.id, tokenId))
		.limit(1);
	if (!token || token.userId !== userId) throw new UserNotFound();
	return token;
}

async function getPolicyState(
	executor: DatabaseExecutor,
	key: string,
): Promise<{ readonly enabled: boolean; readonly subjectKind: "account" | "token" } | undefined> {
	const [policy] = await executor
		.select({ enabled: apiQuotaPolicy.enabled, subjectKind: apiQuotaPolicy.subjectKind })
		.from(apiQuotaPolicy)
		.where(eq(apiQuotaPolicy.key, key))
		.limit(1);
	return policy;
}

export default new Elysia({ prefix: "/api-quota-policies" })
	.use(session)
	.get(
		"",
		async ({ authorization }) => {
			await authorization.platform.ensureCapability("platform.api_quota_policy.read");
			return { items: await listApiQuotaPolicies() };
		},
		{
			access: "session-only",
			response: {
				[StatusCodes.OK]: ApiQuotaPolicyListResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
			},
			detail: { summary: "List API quota policies", tags: ["API Quota Policies"] },
		},
	)
	.put(
		"/:policyKey",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability("platform.api_quota_policy.update");
			try {
				return await database.transaction(async (tx) => {
					const updated = await reviseApiQuotaPolicy(tx, {
						key: params.policyKey,
						expectedRevision: body.expectedRevision,
						configuration: body.configuration,
						reason: body.reason,
						actorProfileId: profile.unitId,
					});
					if (!updated) {
						if (!(await getPolicyState(tx, params.policyKey)))
							throw new ApiQuotaPolicyNotFound();
						throw new ApiQuotaPolicyRevisionConflict();
					}
					await recordAuditEvent(tx, {
						category: "admin_activity",
						outcome: "succeeded",
						actor: { kind: "profile", profileId: profile.unitId },
						authority: { kind: "platform" },
						action: "api_quota.policy.revise",
						target: { kind: "api_quota_policy", id: updated.id },
						details: {
							key: updated.key,
							revision: updated.revision,
							reason: body.reason,
						},
					});
					return updated;
				});
			} catch (error) {
				if (
					error instanceof ApiQuotaPolicyDocumentInvalid ||
					error instanceof ApiQuotaAssignmentInvalid
				)
					throw new ApiQuotaPolicyInvalid();
				throw error;
			}
		},
		{
			access: "fresh-session-only",
			params: ApiQuotaPolicyParams,
			body: ReviseApiQuotaPolicyBody,
			response: {
				[StatusCodes.OK]: ApiQuotaPolicySummary,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
				[StatusCodes.NOT_FOUND]: PolicyNotFoundResponse,
				[StatusCodes.CONFLICT]: PolicyRevisionConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: PolicyInvalidResponse,
			},
			detail: {
				summary: "Publish an API quota policy revision",
				tags: ["API Quota Policies"],
			},
		},
	)
	.get(
		"/accounts/:userId",
		async ({ authorization, params }) => {
			await authorization.platform.ensureCapability("platform.user.api_quota.read");
			await requireUser(database, params.userId);
			return presentAccountQuota(await resolveApiAccountQuotaPolicy(params.userId));
		},
		{
			access: "session-only",
			params: ApiAccountQuotaParams,
			response: {
				[StatusCodes.OK]: ApiAccountQuotaPolicyResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
			},
			detail: { summary: "Get a user's API quota", tags: ["API Quota Policies"] },
		},
	)
	.put(
		"/accounts/:userId",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability("platform.user.api_quota.update");
			try {
				return await database.transaction(async (tx) => {
					await requireUser(tx, params.userId);
					const assigned = await assignApiAccountQuotaPolicy(tx, {
						userId: params.userId,
						policyKey: body.policyKey,
						expectedRevision: body.expectedRevision,
						validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
						reason: body.reason,
						override: body.configurationOverride ?? {},
						actorProfileId: profile.unitId,
					});
					if (!assigned) {
						const policy = await getPolicyState(tx, body.policyKey);
						if (!policy) throw new ApiQuotaPolicyNotFound();
						if (!policy.enabled || policy.subjectKind !== "account")
							throw new ApiQuotaPolicyInvalid();
						throw new ApiAccountQuotaRevisionConflict();
					}
					await recordAuditEvent(tx, {
						category: "admin_activity",
						outcome: "succeeded",
						actor: { kind: "profile", profileId: profile.unitId },
						authority: { kind: "platform" },
						action: "api_quota.account.assign",
						target: { kind: "platform_user", id: params.userId },
						details: {
							policyKey: assigned.key,
							bindingRevision: assigned.bindingRevision,
							reason: body.reason,
						},
					});
					return presentAccountQuota(assigned);
				});
			} catch (error) {
				if (
					error instanceof ApiQuotaPolicyDocumentInvalid ||
					error instanceof ApiQuotaAssignmentInvalid
				)
					throw new ApiQuotaPolicyInvalid();
				throw error;
			}
		},
		{
			access: "fresh-session-only",
			params: ApiAccountQuotaParams,
			body: AssignApiAccountQuotaBody,
			response: {
				[StatusCodes.OK]: ApiAccountQuotaPolicyResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UserNotFound",
					"ApiQuotaPolicyNotFound",
				]),
				[StatusCodes.CONFLICT]: AccountQuotaRevisionConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: PolicyInvalidResponse,
			},
			detail: { summary: "Assign a user's API quota policy", tags: ["API Quota Policies"] },
		},
	)
	.delete(
		"/accounts/:userId",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability("platform.user.api_quota.update");
			return database.transaction(async (tx) => {
				await requireUser(tx, params.userId);
				const reset = await resetApiAccountQuotaPolicy(tx, {
					userId: params.userId,
					expectedRevision: body.expectedRevision,
				});
				if (!reset) throw new ApiAccountQuotaRevisionConflict();
				await recordAuditEvent(tx, {
					category: "admin_activity",
					outcome: "succeeded",
					actor: { kind: "profile", profileId: profile.unitId },
					authority: { kind: "platform" },
					action: "api_quota.account.reset",
					target: { kind: "platform_user", id: params.userId },
				});
				return presentAccountQuota(
					await resolveApiAccountQuotaPolicy(params.userId, { executor: tx }),
				);
			});
		},
		{
			access: "fresh-session-only",
			params: ApiAccountQuotaParams,
			body: ResetApiAccountQuotaBody,
			response: {
				[StatusCodes.OK]: ApiAccountQuotaPolicyResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
				[StatusCodes.CONFLICT]: AccountQuotaRevisionConflictResponse,
			},
			detail: { summary: "Reset a user's API quota policy", tags: ["API Quota Policies"] },
		},
	)
	.get(
		"/accounts/:userId/tokens",
		async ({ authorization, params }) => {
			await authorization.platform.ensureCapability("platform.user.api_token.api_quota.read");
			await requireUser(database, params.userId);
			const tokens = await database
				.select({
					id: apikeys.id,
					name: apikeys.name,
					start: apikeys.start,
					prefix: apikeys.prefix,
					enabled: apikeys.enabled,
					expiresAt: apikeys.expiresAt,
					lastUsedAt: apikeys.lastRequest,
					createdAt: apikeys.createdAt,
					updatedAt: apikeys.updatedAt,
				})
				.from(apikeys)
				.where(eq(apikeys.referenceId, params.userId))
				.orderBy(desc(apikeys.createdAt));
			const quotas = await Promise.all(
				tokens.map((token) => resolveApiTokenQuotaPolicy(token.id)),
			);
			return {
				items: tokens.map((token, index) => ({
					id: token.id,
					name: token.name ?? "",
					tokenPrefix: token.start ?? token.prefix ?? "",
					enabled: token.enabled ?? false,
					expiresAt: token.expiresAt,
					lastUsedAt: token.lastUsedAt,
					createdAt: token.createdAt,
					updatedAt: token.updatedAt,
					quota: presentTokenQuota(quotas[index]!),
				})),
			};
		},
		{
			access: "session-only",
			params: ApiAccountQuotaParams,
			response: {
				[StatusCodes.OK]: ManagedApiTokenQuotaListResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
			},
			detail: { summary: "List a user's API token quotas", tags: ["API Quota Policies"] },
		},
	)
	.put(
		"/accounts/:userId/tokens/:tokenId",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability(
				"platform.user.api_token.api_quota.update",
			);
			try {
				return await database.transaction(async (tx) => {
					await requireOwnedToken(tx, params.userId, params.tokenId);
					const assigned = await assignApiTokenQuotaPolicy(tx, {
						tokenId: params.tokenId,
						policyKey: body.policyKey,
						expectedRevision: body.expectedRevision,
						validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
						reason: body.reason,
						override: body.configurationOverride ?? {},
						actorProfileId: profile.unitId,
					});
					if (!assigned) {
						const policy = await getPolicyState(tx, body.policyKey);
						if (!policy) throw new ApiQuotaPolicyNotFound();
						if (!policy.enabled || policy.subjectKind !== "token")
							throw new ApiQuotaPolicyInvalid();
						throw new ApiTokenQuotaRevisionConflict();
					}
					await recordAuditEvent(tx, {
						category: "admin_activity",
						outcome: "succeeded",
						actor: { kind: "profile", profileId: profile.unitId },
						authority: { kind: "platform" },
						action: "api_quota.token.assign",
						target: { kind: "api_token", id: params.tokenId },
						details: {
							userId: params.userId,
							policyKey: assigned.key,
							bindingRevision: assigned.bindingRevision,
							reason: body.reason,
						},
					});
					return presentTokenQuota(assigned);
				});
			} catch (error) {
				if (
					error instanceof ApiQuotaPolicyDocumentInvalid ||
					error instanceof ApiQuotaAssignmentInvalid
				)
					throw new ApiQuotaPolicyInvalid();
				throw error;
			}
		},
		{
			access: "fresh-session-only",
			params: ApiAccountTokenQuotaParams,
			body: AssignApiTokenQuotaBody,
			response: {
				[StatusCodes.OK]: ApiTokenQuotaPolicyResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UserNotFound",
					"ApiQuotaPolicyNotFound",
				]),
				[StatusCodes.CONFLICT]: TokenQuotaRevisionConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: PolicyInvalidResponse,
			},
			detail: { summary: "Assign an API token quota policy", tags: ["API Quota Policies"] },
		},
	)
	.delete(
		"/accounts/:userId/tokens/:tokenId",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability(
				"platform.user.api_token.api_quota.update",
			);
			return database.transaction(async (tx) => {
				await requireOwnedToken(tx, params.userId, params.tokenId);
				const reset = await resetApiTokenQuotaPolicy(tx, {
					tokenId: params.tokenId,
					expectedRevision: body.expectedRevision,
				});
				if (!reset) throw new ApiTokenQuotaRevisionConflict();
				await recordAuditEvent(tx, {
					category: "admin_activity",
					outcome: "succeeded",
					actor: { kind: "profile", profileId: profile.unitId },
					authority: { kind: "platform" },
					action: "api_quota.token.reset",
					target: { kind: "api_token", id: params.tokenId },
					details: { userId: params.userId },
				});
				return presentTokenQuota(
					await resolveApiTokenQuotaPolicy(params.tokenId, { executor: tx }),
				);
			});
		},
		{
			access: "fresh-session-only",
			params: ApiAccountTokenQuotaParams,
			body: ResetApiTokenQuotaBody,
			response: {
				[StatusCodes.OK]: ApiTokenQuotaPolicyResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
				[StatusCodes.CONFLICT]: TokenQuotaRevisionConflictResponse,
			},
			detail: { summary: "Reset an API token quota policy", tags: ["API Quota Policies"] },
		},
	);
