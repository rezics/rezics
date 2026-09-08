import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import {
	createReviewedUnitMerge,
	getUnitMergeRequest,
	listUnitMergeRequests,
	preflightUnitMerge,
	retryUnitMerge,
	reviewUnitMerge,
	listMergeReconciliationItems,
} from "../../units/merge/service";
import { resolveMergeReconciliationItem } from "../../units/merge/worker";
import {
	MergePreflightSchema,
	MergeCreateSchema,
	MergeReviewSchema,
	MergeListSchema,
	MergeItemListSchema,
	MergeResolveItemSchema,
	MergeManifestSchema,
	MergeRequestSchema,
	MergeItemSchema,
	mergePage,
} from "../../units/merge/contracts";
const requestParams = z.strictObject({ requestId: z.uuid() }),
	itemParams = requestParams.extend({ itemId: z.uuid() });
/** Native identity review and explicit data reconciliation; no direct or Variant merge path. */
export default new Elysia({ prefix: "/platform/unit-merges" })
	.use(session)
	.get(
		"",
		{
			access: "session-only",
			query: MergeListSchema,
			response: mergePage(MergeRequestSchema),
			detail: {
				operationId: "listNativeMergeRequests",
				summary: "List native identity merge requests",
				tags: ["Governance"],
			},
		},
		({ authorization, query }) => listUnitMergeRequests(authorization, query),
	)
	.get(
		"/:requestId",
		{
			access: "session-only",
			params: requestParams,
			response: MergeRequestSchema,
			detail: {
				operationId: "readNativeMergeRequest",
				summary: "Read a native identity merge request",
				tags: ["Governance"],
			},
		},
		({ authorization, params }) => getUnitMergeRequest(authorization, params.requestId),
	)
	.post(
		"/preflight",
		{
			access: "session-only",
			body: MergePreflightSchema,
			response: MergeManifestSchema,
			detail: {
				operationId: "preflightNativeMerge",
				summary: "Inspect native merge compatibility and reconciliation policy",
				tags: ["Governance"],
			},
		},
		({ authorization, body }) => preflightUnitMerge(authorization, body),
	)
	.post(
		"",
		{
			access: "fresh-session-only",
			body: MergeCreateSchema,
			response: MergeRequestSchema,
			detail: {
				operationId: "proposeNativeMerge",
				summary: "Propose a native merge for two independent reviews",
				tags: ["Governance"],
			},
		},
		({ authorization, body }) => createReviewedUnitMerge(authorization, body),
	)
	.post(
		"/:requestId/reviews",
		{
			access: "fresh-session-only",
			params: requestParams,
			body: MergeReviewSchema,
			response: MergeRequestSchema,
			detail: {
				operationId: "reviewNativeMerge",
				summary: "Review a pinned native merge and data plan",
				tags: ["Governance"],
			},
		},
		({ authorization, params, body }) => reviewUnitMerge(authorization, params.requestId, body),
	)
	.post(
		"/:requestId/retry",
		{
			access: "fresh-session-only",
			params: requestParams,
			response: MergeRequestSchema,
			detail: {
				operationId: "retryNativeMerge",
				summary: "Retry native merge work under current authority",
				tags: ["Governance"],
			},
		},
		({ authorization, params }) => retryUnitMerge(authorization, params.requestId),
	)
	.get(
		"/:requestId/items",
		{
			access: "session-only",
			params: requestParams,
			query: MergeItemListSchema,
			response: mergePage(MergeItemSchema),
			detail: {
				operationId: "listNativeMergeReconciliation",
				summary: "Inspect copied and retained native merge evidence",
				tags: ["Governance"],
			},
		},
		({ authorization, params, query }) =>
			listMergeReconciliationItems(authorization, params.requestId, query),
	)
	.post(
		"/:requestId/items/:itemId/resolve",
		{
			access: "fresh-session-only",
			params: itemParams,
			body: MergeResolveItemSchema,
			response: z.strictObject({ resolved: z.literal(true) }),
			detail: {
				operationId: "resolveNativeMergeReconciliation",
				summary: "Resolve one native reconciliation decision",
				tags: ["Governance"],
			},
		},
		({ authorization, params, body }) =>
			resolveMergeReconciliationItem(authorization, params.requestId, params.itemId, body),
	);
