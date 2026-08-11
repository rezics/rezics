import { and, count, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";

import Elysia, { t } from "elysia";

import { recordAuditEvent } from "../../audit";
import { fromApiKeyPermissions, toApiKeyPermissions } from "../../auth/api-permissions";
import { ApiQuotaPolicyDocumentInvalid } from "../../auth/api-quota/policy-schema";
import {
	deleteApiTokenQuotaOverride,
	getApiTokenQuotaOverride,
	replaceApiTokenQuotaOverride,
	resolveApiAccountQuotaPolicy,
	resolveApiTokenQuotaPolicy,
	type ApiTokenQuotaOverrideSummary,
	type ResolvedApiAccountQuotaPolicy,
	type ResolvedApiTokenQuotaPolicy,
} from "../../auth/api-quota/policy-service";
import { auth } from "../../auth";
import session from "../../auth/session";
import { database, type DatabaseTransaction } from "../../database";
import { apikeys, apiTokenCreationReservation } from "../../database/schema";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	ApiTokenLimitReached,
	ApiTokenNotFound,
	ApiTokenQuotaOverrideInvalid,
	ApiTokenQuotaOverrideRevisionConflict,
} from "./errors";
import {
	ApiTokenListResponse,
	ApiTokenParams,
	ApiTokenSummary,
	CreatedApiTokenResponse,
	CreateApiTokenBody,
	DeleteApiTokenQuotaOverrideBody,
	ReplaceApiTokenQuotaOverrideBody,
	UpdateApiTokenBody,
} from "./schema";
import { requiresActiveTokenReservation } from "./inventory";

const InteractiveSessionRequiredResponse = toApiErrorResponse(["InteractiveSessionRequired"]);
const FreshSessionRequiredResponse = toApiErrorResponse(["FreshSessionRequired"]);
const TokenNotFoundResponse = toApiErrorResponse(["ApiTokenNotFound"]);
const TokenLimitReachedResponse = toApiErrorResponse(["ApiTokenLimitReached"]);
const TokenQuotaInvalidResponse = toApiErrorResponse(["ApiTokenQuotaOverrideInvalid"]);
const TokenQuotaRevisionConflictResponse = toApiErrorResponse([
	"ApiTokenQuotaOverrideRevisionConflict",
]);

type BetterAuthApiKey = Awaited<ReturnType<typeof auth.api.listApiKeys>>["apiKeys"][number];
type CreatedBetterAuthApiKey = Awaited<ReturnType<typeof auth.api.createApiKey>>;

function presentAccountQuota(policy: ResolvedApiAccountQuotaPolicy) {
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

function presentTokenQuotaOverride(override: ApiTokenQuotaOverrideSummary | undefined) {
	return override
		? {
				configurationOverride: override.configurationOverride,
				revision: override.revision,
				updatedAt: override.updatedAt,
			}
		: null;
}

function presentTokenQuota(policy: ResolvedApiTokenQuotaPolicy) {
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

function presentToken(
	key: BetterAuthApiKey,
	accountQuota: ResolvedApiAccountQuotaPolicy,
	tokenQuota: ResolvedApiTokenQuotaPolicy,
	tokenQuotaOverride: ApiTokenQuotaOverrideSummary | undefined,
) {
	return {
		id: key.id,
		name: key.name ?? "",
		tokenPrefix: key.start ?? key.prefix ?? "",
		permissions: fromApiKeyPermissions(key.permissions),
		enabled: key.enabled,
		expiresAt: key.expiresAt,
		lastUsedAt: key.lastRequest,
		createdAt: key.createdAt,
		updatedAt: key.updatedAt,
		quota: {
			account: presentAccountQuota(accountQuota),
			token: presentTokenQuota(tokenQuota),
			tokenOverride: presentTokenQuotaOverride(tokenQuotaOverride),
		},
	};
}

async function findOwnedToken(request: Request, tokenId: string) {
	const listed = await auth.api.listApiKeys({ headers: request.headers });
	const key = listed.apiKeys.find((candidate) => candidate.id === tokenId);
	if (!key) throw new ApiTokenNotFound();
	return key;
}

async function lockAccountTokenInventory(tx: DatabaseTransaction, userId: string): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`api-token-inventory:${userId}`}::text, 0))`,
	);
}

async function ensureActiveTokenCapacity(
	tx: DatabaseTransaction,
	input: { userId: string; maxActiveTokens: number; excludedTokenId?: string; now: Date },
): Promise<void> {
	const [usage] = await tx
		.select({ active: count() })
		.from(apikeys)
		.where(
			and(
				eq(apikeys.referenceId, input.userId),
				eq(apikeys.enabled, true),
				or(isNull(apikeys.expiresAt), gt(apikeys.expiresAt, input.now)),
				...(input.excludedTokenId ? [ne(apikeys.id, input.excludedTokenId)] : []),
			),
		);
	const [reservations] = await tx
		.select({ active: count() })
		.from(apiTokenCreationReservation)
		.where(eq(apiTokenCreationReservation.accountUserId, input.userId));
	if ((usage?.active ?? 0) + (reservations?.active ?? 0) >= input.maxActiveTokens)
		throw new ApiTokenLimitReached({ maxActiveTokens: input.maxActiveTokens });
}

const TokenReservationDurationMilliseconds = 60_000;

async function reserveActiveTokenSlot(input: {
	userId: string;
	excludedTokenId?: string;
}): Promise<{ accountQuota: ResolvedApiAccountQuotaPolicy; reservationId: string }> {
	return database.transaction(async (tx) => {
		const now = new Date();
		await lockAccountTokenInventory(tx, input.userId);
		await tx
			.delete(apiTokenCreationReservation)
			.where(lte(apiTokenCreationReservation.expiresAt, now));
		const accountQuota = await resolveApiAccountQuotaPolicy(input.userId, {
			executor: tx,
		});
		await ensureActiveTokenCapacity(tx, {
			userId: input.userId,
			maxActiveTokens: accountQuota.configuration.maxActiveTokens,
			excludedTokenId: input.excludedTokenId,
			now,
		});
		const [reservation] = await tx
			.insert(apiTokenCreationReservation)
			.values({
				accountUserId: input.userId,
				expiresAt: new Date(now.getTime() + TokenReservationDurationMilliseconds),
				createdAt: now,
			})
			.returning({ id: apiTokenCreationReservation.id });
		if (!reservation) throw new Error("API token inventory reservation was not created");
		return { accountQuota, reservationId: reservation.id };
	});
}

async function releaseActiveTokenSlot(reservationId: string): Promise<void> {
	await database
		.delete(apiTokenCreationReservation)
		.where(eq(apiTokenCreationReservation.id, reservationId));
}

export default new Elysia({ prefix: "/api-tokens" })
	.use(session)
	.get(
		"",
		async ({ user, request, set }) => {
			set.headers["Cache-Control"] = "no-store";
			const [result, accountQuota] = await Promise.all([
				auth.api.listApiKeys({
					headers: request.headers,
					query: { sortBy: "createdAt", sortDirection: "desc" },
				}),
				resolveApiAccountQuotaPolicy(user.id),
			]);
			const tokenQuotas = await Promise.all(
				result.apiKeys.map(async (key) =>
					Promise.all([resolveApiTokenQuotaPolicy(key.id), getApiTokenQuotaOverride(key.id)]),
				),
			);
			return {
				itemLimit: accountQuota.configuration.maxActiveTokens,
				items: result.apiKeys.map((key, index) =>
					presentToken(key, accountQuota, tokenQuotas[index]![0], tokenQuotas[index]![1]),
				),
			};
		},
		{
			access: "session-only",
			response: {
				[StatusCodes.OK]: ApiTokenListResponse,
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
			},
			detail: { summary: "List API tokens", tags: ["API Tokens"] },
		},
	)
	.post(
		"",
		async ({ user, profile, body, request }) => {
			let created: CreatedBetterAuthApiKey | undefined;
			let reservationId: string | undefined;
			try {
				const reserved = await reserveActiveTokenSlot({ userId: user.id });
				reservationId = reserved.reservationId;
				const newlyCreated = await auth.api.createApiKey({
					body: {
						name: body.name,
						userId: user.id,
						expiresIn: (body.expiresInDays ?? 90) * 24 * 60 * 60,
						permissions: toApiKeyPermissions(body.permissions),
					},
				});
				created = newlyCreated;
				await database.transaction(async (tx) => {
					await tx
						.delete(apiTokenCreationReservation)
						.where(eq(apiTokenCreationReservation.id, reserved.reservationId));
					await recordAuditEvent(tx, {
						category: "admin_activity",
						outcome: "succeeded",
						actor: { kind: "profile", profileId: profile.unitId },
						authority: { kind: "platform" },
						action: "api_token.create",
						target: { kind: "api_token", id: newlyCreated.id },
						details: { permissions: body.permissions },
					});
				});
				return {
					...presentToken(
						newlyCreated,
						reserved.accountQuota,
						await resolveApiTokenQuotaPolicy(newlyCreated.id),
						undefined,
					),
					token: newlyCreated.key,
				};
			} catch (error) {
				if (created)
					await auth.api.deleteApiKey({
						headers: request.headers,
						body: { keyId: created.id },
					});
				if (reservationId) await releaseActiveTokenSlot(reservationId);
				throw error;
			}
		},
		{
			access: "fresh-session-only",
			body: CreateApiTokenBody,
			response: {
				[StatusCodes.OK]: CreatedApiTokenResponse,
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
				[StatusCodes.CONFLICT]: TokenLimitReachedResponse,
			},
			detail: { summary: "Create API token (secret returned once)", tags: ["API Tokens"] },
		},
	)
	.patch(
		"/:tokenId",
		async ({ user, profile, params, body, request }) => {
			const current = await findOwnedToken(request, params.tokenId);
			const now = new Date();
			const becomesActive = requiresActiveTokenReservation(current, body, now);
			const reservation = becomesActive
				? await reserveActiveTokenSlot({
						userId: user.id,
						excludedTokenId: params.tokenId,
					})
				: undefined;
			try {
				const updated = await auth.api.updateApiKey({
					body: {
						keyId: params.tokenId,
						userId: user.id,
						name: body.name,
						permissions: body.permissions ? toApiKeyPermissions(body.permissions) : undefined,
						expiresIn:
							body.expiresInDays === undefined ? undefined : body.expiresInDays * 24 * 60 * 60,
						enabled: body.enabled,
					},
				});
				await database.transaction(async (tx) => {
					if (reservation)
						await tx
							.delete(apiTokenCreationReservation)
							.where(eq(apiTokenCreationReservation.id, reservation.reservationId));
					await recordAuditEvent(tx, {
						category: "admin_activity",
						outcome: "succeeded",
						actor: { kind: "profile", profileId: profile.unitId },
						authority: { kind: "platform" },
						action: "api_token.update",
						target: { kind: "api_token", id: params.tokenId },
						details: {
							nameChanged: body.name !== undefined,
							permissionsChanged: body.permissions !== undefined,
							expiryChanged: body.expiresInDays !== undefined,
							enabledChanged: body.enabled !== undefined,
						},
					});
				});
				const [accountQuota, tokenQuota, tokenOverride] = await Promise.all([
					resolveApiAccountQuotaPolicy(user.id),
					resolveApiTokenQuotaPolicy(updated.id),
					getApiTokenQuotaOverride(updated.id),
				]);
				return presentToken(updated, accountQuota, tokenQuota, tokenOverride);
			} catch (error) {
				if (reservation) await releaseActiveTokenSlot(reservation.reservationId);
				throw error;
			}
		},
		{
			access: "fresh-session-only",
			params: ApiTokenParams,
			body: UpdateApiTokenBody,
			response: {
				[StatusCodes.OK]: ApiTokenSummary,
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
				[StatusCodes.NOT_FOUND]: TokenNotFoundResponse,
				[StatusCodes.CONFLICT]: TokenLimitReachedResponse,
			},
			detail: { summary: "Update API token", tags: ["API Tokens"] },
		},
	)
	.put(
		"/:tokenId/quota-override",
		async ({ user, profile, params, body, request }) => {
			const key = await findOwnedToken(request, params.tokenId);
			try {
				const replaced = await database.transaction(async (tx) => {
					const value = await replaceApiTokenQuotaOverride(tx, {
						tokenId: params.tokenId,
						actorProfileId: profile.unitId,
						expectedRevision: body.expectedRevision,
						override: body.configurationOverride,
					});
					if (!value) throw new ApiTokenQuotaOverrideRevisionConflict();
					await recordAuditEvent(tx, {
						category: "admin_activity",
						outcome: "succeeded",
						actor: { kind: "profile", profileId: profile.unitId },
						authority: { kind: "platform" },
						action: "api_token.quota_override.replace",
						target: { kind: "api_token", id: params.tokenId },
						details: { revision: value.revision },
					});
					return value;
				});
				const [accountQuota, tokenQuota] = await Promise.all([
					resolveApiAccountQuotaPolicy(user.id),
					resolveApiTokenQuotaPolicy(key.id),
				]);
				return presentToken(key, accountQuota, tokenQuota, replaced);
			} catch (error) {
				if (error instanceof ApiQuotaPolicyDocumentInvalid)
					throw new ApiTokenQuotaOverrideInvalid();
				throw error;
			}
		},
		{
			access: "fresh-session-only",
			params: ApiTokenParams,
			body: ReplaceApiTokenQuotaOverrideBody,
			response: {
				[StatusCodes.OK]: ApiTokenSummary,
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
				[StatusCodes.NOT_FOUND]: TokenNotFoundResponse,
				[StatusCodes.CONFLICT]: TokenQuotaRevisionConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: TokenQuotaInvalidResponse,
			},
			detail: { summary: "Replace API token quota override", tags: ["API Tokens"] },
		},
	)
	.delete(
		"/:tokenId/quota-override",
		async ({ profile, params, body, request, status }) => {
			await findOwnedToken(request, params.tokenId);
			await database.transaction(async (tx) => {
				const deleted = await deleteApiTokenQuotaOverride(tx, {
					tokenId: params.tokenId,
					expectedRevision: body.expectedRevision,
				});
				if (!deleted) throw new ApiTokenQuotaOverrideRevisionConflict();
				await recordAuditEvent(tx, {
					category: "admin_activity",
					outcome: "succeeded",
					actor: { kind: "profile", profileId: profile.unitId },
					authority: { kind: "platform" },
					action: "api_token.quota_override.delete",
					target: { kind: "api_token", id: params.tokenId },
				});
			});
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			access: "fresh-session-only",
			params: ApiTokenParams,
			body: DeleteApiTokenQuotaOverrideBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
				[StatusCodes.NOT_FOUND]: TokenNotFoundResponse,
				[StatusCodes.CONFLICT]: TokenQuotaRevisionConflictResponse,
			},
			detail: {
				summary: "Delete API token quota override",
				tags: ["API Tokens"],
				responses: NoContentResponse,
			},
		},
	)
	.delete(
		"/:tokenId",
		async ({ request, profile, params, status }) => {
			await findOwnedToken(request, params.tokenId);
			await auth.api.deleteApiKey({
				headers: request.headers,
				body: { keyId: params.tokenId },
			});
			await recordAuditEvent(database, {
				category: "admin_activity",
				outcome: "succeeded",
				actor: { kind: "profile", profileId: profile.unitId },
				authority: { kind: "platform" },
				action: "api_token.revoke",
				target: { kind: "api_token", id: params.tokenId },
			});
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			access: "fresh-session-only",
			params: ApiTokenParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
				[StatusCodes.NOT_FOUND]: TokenNotFoundResponse,
			},
			detail: {
				summary: "Revoke API token",
				tags: ["API Tokens"],
				responses: NoContentResponse,
			},
		},
	);
