import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";

import Elysia from "elysia";

import { recordAuditEvent } from "../../audit";
import { ApiTokenPolicyDocumentInvalid } from "../../auth/api-token/policy-schema";
import {
	ApiTokenPolicyAssignmentInvalid,
	assignApiTokenPolicy,
	listApiTokenPolicies,
	replaceApiTokenPolicyConfiguration,
} from "../../auth/api-token/policy-service";
import session from "../../auth/session";
import { database } from "../../database";
import { apiAccessPolicy, apikeys } from "../../database/schema";
import { toApiErrorResponse } from "../schema/response";
import {
	ApiTokenNotFound,
	ApiTokenPolicyInvalid,
	ApiTokenPolicyNotFound,
	ApiTokenPolicyRevisionConflict,
} from "../tokens/errors";
import { ApiTokenPolicy } from "../tokens/schema";
import {
	ApiAccessPolicyListResponse,
	ApiAccessPolicyParams,
	ApiAccessPolicySummary,
	ApiTokenPolicyBindingParams,
	AssignApiTokenPolicyBody,
	ReplaceApiAccessPolicyBody,
} from "./schema";

const AuthenticationResponse = toApiErrorResponse(["InteractiveSessionRequired"]);
const PlatformAccessResponse = toApiErrorResponse([
	"FreshSessionRequired",
	"PlatformCapabilityRequired",
]);
const PolicyNotFoundResponse = toApiErrorResponse(["ApiTokenPolicyNotFound"]);
const TokenOrPolicyNotFoundResponse = toApiErrorResponse([
	"ApiTokenNotFound",
	"ApiTokenPolicyNotFound",
]);
const PolicyInvalidResponse = toApiErrorResponse(["ApiTokenPolicyInvalid"]);
const RevisionConflictResponse = toApiErrorResponse(["ApiTokenPolicyRevisionConflict"]);

export default new Elysia({ prefix: "/api-token-policies" })
	.use(session)
	.get(
		"",
		async ({ authorization }) => {
			await authorization.platform.ensureCapability("platform.api_token_policy.manage");
			return { items: await listApiTokenPolicies() };
		},
		{
			access: "fresh-session-only",
			response: {
				[StatusCodes.OK]: ApiAccessPolicyListResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
			},
			detail: {
				summary: "List API token policies with platform access",
				tags: ["API Token Policies"],
			},
		},
	)
	.patch(
		"/:policyKey",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability("platform.api_token_policy.manage");
			try {
				return await database.transaction(async (tx) => {
					const updated = await replaceApiTokenPolicyConfiguration(tx, {
						key: params.policyKey,
						expectedRevision: body.expectedRevision,
						configuration: body.configuration,
						actorProfileId: profile.unitId,
					});
					if (!updated) {
						const [existing] = await tx
							.select({ id: apiAccessPolicy.id })
							.from(apiAccessPolicy)
							.where(eq(apiAccessPolicy.key, params.policyKey))
							.limit(1);
						if (!existing) throw new ApiTokenPolicyNotFound();
						throw new ApiTokenPolicyRevisionConflict();
					}
					await recordAuditEvent(tx, {
						category: "admin_activity",
						outcome: "succeeded",
						actor: { kind: "profile", profileId: profile.unitId },
						authority: { kind: "platform" },
						action: "api_token.policy.replace",
						target: { kind: "api_token_policy", id: updated.id },
						details: { key: updated.key, revision: updated.revision },
					});
					return updated;
				});
			} catch (error) {
				if (error instanceof ApiTokenPolicyDocumentInvalid)
					throw new ApiTokenPolicyInvalid();
				throw error;
			}
		},
		{
			access: "fresh-session-only",
			params: ApiAccessPolicyParams,
			body: ReplaceApiAccessPolicyBody,
			response: {
				[StatusCodes.OK]: ApiAccessPolicySummary,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
				[StatusCodes.NOT_FOUND]: PolicyNotFoundResponse,
				[StatusCodes.CONFLICT]: RevisionConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: PolicyInvalidResponse,
			},
			detail: {
				summary: "Replace an API token policy with platform access",
				tags: ["API Token Policies"],
			},
		},
	)
	.put(
		"/bindings/:tokenId",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability("platform.api_token_policy.manage");
			const [token] = await database
				.select({ id: apikeys.id })
				.from(apikeys)
				.where(eq(apikeys.id, params.tokenId))
				.limit(1);
			if (!token) throw new ApiTokenNotFound();
			try {
				return await database.transaction(async (tx) => {
					const assigned = await assignApiTokenPolicy(tx, {
						tokenId: params.tokenId,
						policyKey: body.policyKey,
						validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
						reason: body.reason,
						override: body.configurationOverride ?? {},
						actorProfileId: profile.unitId,
					});
					if (!assigned) throw new ApiTokenPolicyNotFound();
					await recordAuditEvent(tx, {
						category: "admin_activity",
						outcome: "succeeded",
						actor: { kind: "profile", profileId: profile.unitId },
						authority: { kind: "platform" },
						action: "api_token.policy.assign",
						target: { kind: "api_token", id: params.tokenId },
						details: {
							policyKey: assigned.key,
							bindingRevision: assigned.bindingRevision,
							reason: body.reason,
						},
					});
					return {
						key: assigned.key,
						kind: assigned.kind,
						source: assigned.source,
						schemaVersion: assigned.schemaVersion,
						policyRevision: assigned.policyRevision,
						bindingRevision: assigned.bindingRevision,
						validUntil: assigned.validUntil,
						limits: assigned.configuration.limits,
						operations: assigned.configuration.operations,
					};
				});
			} catch (error) {
				if (
					error instanceof ApiTokenPolicyDocumentInvalid ||
					error instanceof ApiTokenPolicyAssignmentInvalid
				)
					throw new ApiTokenPolicyInvalid();
				throw error;
			}
		},
		{
			access: "fresh-session-only",
			params: ApiTokenPolicyBindingParams,
			body: AssignApiTokenPolicyBody,
			response: {
				[StatusCodes.OK]: ApiTokenPolicy,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessResponse,
				[StatusCodes.NOT_FOUND]: TokenOrPolicyNotFoundResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: PolicyInvalidResponse,
			},
			detail: {
				summary: "Assign an API token policy with platform access",
				tags: ["API Token Policies"],
			},
		},
	);
