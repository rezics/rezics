import { StatusCodes } from "http-status-codes";
import Elysia, { type Static } from "elysia";

import session from "../../auth/session";
import {
	createDirectUnitMerge,
	createReviewedUnitMerge,
	getUnitMergeRequest,
	listUnitMergeRequests,
	preflightUnitMerge,
	retryUnitMerge,
	reviewUnitMerge,
} from "../../units/merge/service";
import { toApiErrorResponse } from "../schema/response";
import { UnitMergeConfirmationInvalid } from "./errors";
import {
	CreateDirectUnitMergeBody,
	CreateReviewedUnitMergeBody,
	ListUnitMergeRequestsQuery,
	ReviewUnitMergeBody,
	UnitMergePreflightBody,
	UnitMergePreflightResponse,
	UnitMergeRequestListResponse,
	UnitMergeRequestParams,
	UnitMergeRequestResponse,
} from "./schema";

const MergeNotFoundResponse = toApiErrorResponse(["UnitMergeNotFound", "UnitNotFound"]);
const MergeConflictResponse = toApiErrorResponse([
	"UnitMergeKindMismatch",
	"UnitMergeRequestConflict",
	"UnitMergeIdempotencyConflict",
	"UnitMergeManifestStale",
]);
const MergeRuleConflictResponse = toApiErrorResponse([
	"UnitMergeKindMismatch",
	"UnitMergeRequestConflict",
	"UnitMergeIdempotencyConflict",
	"UnitMergeManifestStale",
	"GovernanceRuleChanged",
]);

function presentMergeRequest(
	request: Awaited<ReturnType<typeof getUnitMergeRequest>>,
): Static<typeof UnitMergeRequestResponse> {
	return request;
}

function requireMatchingConfirmations(body: {
	readonly sourceUnitId: string;
	readonly targetUnitId: string;
	readonly confirmationSourceUnitId: string;
	readonly confirmationTargetUnitId: string;
}): void {
	if (
		body.sourceUnitId !== body.confirmationSourceUnitId ||
		body.targetUnitId !== body.confirmationTargetUnitId
	)
		throw new UnitMergeConfirmationInvalid();
}

export default new Elysia({ prefix: "/platform/unit-merges" })
	.use(session)
	.get(
		"",
		async ({ authorization, query }) => {
			await authorization.platform.ensureCapability("unit.governance.read");
			const result = await listUnitMergeRequests({
				state: query.state,
				cursor: query.cursor,
				limit: query.limit ?? 50,
			});
			return { ...result, items: result.items.map(presentMergeRequest) };
		},
		{
			access: "session-only",
			query: ListUnitMergeRequestsQuery,
			response: {
				[StatusCodes.OK]: UnitMergeRequestListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
			},
			detail: { summary: "List Unit merge governance requests", tags: ["Governance"] },
		},
	)
	.get(
		"/:requestId",
		async ({ authorization, params }) => {
			await authorization.platform.ensureCapability("unit.governance.read");
			return presentMergeRequest(await getUnitMergeRequest(params.requestId));
		},
		{
			access: "session-only",
			params: UnitMergeRequestParams,
			response: {
				[StatusCodes.OK]: UnitMergeRequestResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitMergeNotFound"]),
			},
			detail: { summary: "Get a Unit merge governance request", tags: ["Governance"] },
		},
	)
	.post(
		"/preflight",
		async ({ authorization, body }) => {
			await authorization.platform.ensureCapability("unit.merge.propose");
			return preflightUnitMerge(body);
		},
		{
			access: "session-only",
			body: UnitMergePreflightBody,
			response: {
				[StatusCodes.OK]: UnitMergePreflightResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: MergeNotFoundResponse,
				[StatusCodes.CONFLICT]: MergeConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["UnitMergeKindIneligible"]),
			},
			detail: { summary: "Preflight a Unit identity merge", tags: ["Governance"] },
		},
	)
	.post(
		"",
		async ({ authorization, profile, body }) => {
			await authorization.platform.ensureCapability("unit.merge.propose");
			requireMatchingConfirmations(body);
			return presentMergeRequest(
				await createReviewedUnitMerge({
					sourceUnitId: body.sourceUnitId,
					targetUnitId: body.targetUnitId,
					expectedSourceUpdatedAt: new Date(body.expectedSourceUpdatedAt),
					expectedTargetUpdatedAt: new Date(body.expectedTargetUpdatedAt),
					proposerProfileId: profile.unitId,
					idempotencyKey: body.idempotencyKey,
					rules: body.rules,
					note: body.note?.trim() || undefined,
				}),
			);
		},
		{
			access: "fresh-session-only",
			body: CreateReviewedUnitMergeBody,
			response: {
				[StatusCodes.OK]: UnitMergeRequestResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"UnitMergeConfirmationInvalid",
					"GovernanceRuleSourceForbidden",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"FreshSessionRequired",
				]),
				[StatusCodes.NOT_FOUND]: MergeNotFoundResponse,
				[StatusCodes.CONFLICT]: MergeRuleConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["UnitMergeKindIneligible"]),
			},
			detail: { summary: "Propose a reviewed Unit identity merge", tags: ["Governance"] },
		},
	)
	.post(
		"/direct",
		async ({ authorization, profile, body }) => {
			await authorization.platform.ensureCapability("unit.merge");
			requireMatchingConfirmations(body);
			return presentMergeRequest(
				await createDirectUnitMerge({
					sourceUnitId: body.sourceUnitId,
					targetUnitId: body.targetUnitId,
					expectedSourceUpdatedAt: new Date(body.expectedSourceUpdatedAt),
					expectedTargetUpdatedAt: new Date(body.expectedTargetUpdatedAt),
					proposerProfileId: profile.unitId,
					idempotencyKey: body.idempotencyKey,
					rules: body.rules,
					note: body.note?.trim() || undefined,
					overrideOfRequestId: body.overrideOfRequestId,
				}),
			);
		},
		{
			access: "fresh-session-only",
			body: CreateDirectUnitMergeBody,
			response: {
				[StatusCodes.OK]: UnitMergeRequestResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"UnitMergeConfirmationInvalid",
					"GovernanceRuleSourceForbidden",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"FreshSessionRequired",
				]),
				[StatusCodes.NOT_FOUND]: MergeNotFoundResponse,
				[StatusCodes.CONFLICT]: MergeRuleConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["UnitMergeKindIneligible"]),
			},
			detail: {
				summary: "Start a privileged direct Unit identity merge",
				tags: ["Governance"],
			},
		},
	)
	.post(
		"/:requestId/reviews",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability("unit.merge.review");
			return presentMergeRequest(
				await reviewUnitMerge({
					requestId: params.requestId,
					reviewerProfileId: profile.unitId,
					decision: body.decision,
					requestFingerprint: body.requestFingerprint,
					note: body.note?.trim() || undefined,
				}),
			);
		},
		{
			access: "fresh-session-only",
			params: UnitMergeRequestParams,
			body: ReviewUnitMergeBody,
			response: {
				[StatusCodes.OK]: UnitMergeRequestResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"FreshSessionRequired",
					"UnitMergeReviewSelfForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitMergeNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitMergeManifestStale",
					"UnitMergeRequestConflict",
					"UnitMergeReviewDuplicate",
					"UnitMergeReviewFingerprintMismatch",
					"UnitMergeRequestNotPending",
					"UnitMergeRequestExpired",
					"GovernanceRuleChanged",
				]),
			},
			detail: { summary: "Approve or reject a Unit merge request", tags: ["Governance"] },
		},
	)
	.post(
		"/:requestId/retry",
		async ({ authorization, profile, params }) => {
			await authorization.platform.ensureCapability("unit.merge");
			return presentMergeRequest(
				await retryUnitMerge({
					requestId: params.requestId,
					actorProfileId: profile.unitId,
				}),
			);
		},
		{
			access: "fresh-session-only",
			params: UnitMergeRequestParams,
			response: {
				[StatusCodes.OK]: UnitMergeRequestResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"FreshSessionRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitMergeNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitMergeRetryUnavailable",
					"GovernanceRuleChanged",
				]),
			},
			detail: { summary: "Retry a failed Unit merge operation", tags: ["Governance"] },
		},
	);
