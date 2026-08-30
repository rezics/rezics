import { eq } from "drizzle-orm";
import Elysia from "elysia";
import { StatusCodes } from "http-status-codes";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { realm } from "../../database/schema";
import {
	createTagExpression,
	createTagExpressionInferenceRule,
	listTagConceptExpressions,
	retireTagExpressionInferenceRule,
} from "../../tag-expressions/service";
import {
	adoptRealmTagPath,
	adoptRealmTagPathSense,
	applyRealmTagPath,
	applyTagPath,
	clearRealmTagPathApplicationJudgment,
	clearTagPathApplicationJudgment,
	createTagPath,
	createTagPathSense,
	createTagRelation,
	deleteRealmTagPathVote,
	deleteTagPathVote,
	getTagHierarchy,
	getTagPath,
	judgeRealmTagPathApplication,
	judgeTagPathApplication,
	listPendingTagPathMerges,
	listAcceptedTagPathsContaining,
	listRealmTagPaths,
	listTagPathDefinitionWarnings,
	proposeTagPathMerge,
	removeRealmTagPathApplication,
	removeTagPathApplication,
	resolveTagPathMerge,
	retireTagPathSense,
	searchTagPathsForCuration,
	suggestTagExpressions,
	updateRealmTagPathFallbackPolicy,
	voteRealmTagPath,
	voteTagPath,
} from "../../tag-paths/service";
import {
	deleteRealmTagSubscription,
	getUnitTagLandscape,
	listRealmTagSubscriptions,
	upsertRealmTagSubscription,
} from "../../tags/service";
import { UnitNotFound } from "../../units/errors";
import { ValidationError } from "../errors";
import { RealmNotFound } from "../realms/errors";
import { toApiErrorResponse, VoteBackpressureResponse } from "../schema/response";
import { checkUnitType } from "../unit-resources/service";
import {
	ApplyTagPathBody,
	CreateTagExpressionBody,
	CreateTagExpressionInferenceRuleBody,
	CreateTagExpressionInferenceRuleResponse,
	CreateTagExpressionResponse,
	CreateTagPathBody,
	CreateTagPathMergeBody,
	CreateTagPathResponse,
	CreateTagPathSenseBody,
	CreateTagPathSenseResponse,
	CreateTagRelationBody,
	CreateTagRelationResponse,
	ListPendingTagPathMergesQuery,
	ListRealmTagPathsQuery,
	PendingTagPathMergeListResponse,
	RealmApplyTagPathParams,
	RealmTagPathAdoptionResponse,
	RealmTagPathApplicationJudgmentResponse,
	RealmTagPathApplicationParams,
	RealmTagPathApplicationRemovalResponse,
	RealmTagPathApplicationResponse,
	RealmTagPathFallbackBody,
	RealmTagPathFallbackResponse,
	RealmTagPathListResponse,
	RealmTagPathParams,
	RealmTagPathSenseAdoptionResponse,
	RealmTagPathSenseParams,
	RealmTagPathVoteResponse,
	RealmTagSubscriptionListQuery,
	RealmTagSubscriptionListResponse,
	RealmTagSubscriptionParams,
	RealmTagSubscriptionResponse,
	RealmTagSubscriptionStateResponse,
	RetireTagExpressionInferenceRuleResponse,
	RetireTagPathSenseResponse,
	ResolveTagPathMergeBody,
	TagConceptExpressionsQuery,
	TagConceptExpressionsResponse,
	TagExpressionParams,
	TagExpressionInferenceRuleParams,
	TagHierarchyQuery,
	TagHierarchyResponse,
	TagIdParams,
	TagPathApplicationJudgmentBody,
	TagPathApplicationJudgmentResponse,
	TagPathApplicationParams,
	TagPathApplicationRemovalResponse,
	TagPathApplicationResponse,
	TagPathCurationSearchQuery,
	TagPathCurationSearchResponse,
	TagPathDefinitionWarningsBody,
	TagPathDefinitionWarningsResponse,
	TagPathMergeParams,
	TagPathMergeResponse,
	TagPathParams,
	TagPathQuery,
	TagPathResponse,
	TagPathSenseParams,
	TagPathsContainingQuery,
	TagPathsContainingResponse,
	TagSuggestionQuery,
	TagSuggestionResponse,
	UnitTagLandscapeParams,
	UnitTagLandscapeQuery,
	UnitTagLandscapeResponse,
	UpsertRealmTagSubscriptionBody,
	VoteBody,
	VoteSummaryResponse,
} from "./schema";

function asValidationError(error: unknown, field: string): never {
	if (error instanceof TypeError) throw new ValidationError({ [field]: error.message });
	throw error;
}

export default new Elysia()
	.use(session)
	.group("/tags", (app) =>
		app
			.get(
				"/suggestions",
				{
					query: TagSuggestionQuery,
					response: { [StatusCodes.OK]: TagSuggestionResponse },
					detail: { summary: "Suggest explicit Tag Expressions and Path Senses", tags: ["Tags"] },
				},
				async ({ query }) => ({
					items: await suggestTagExpressions({
						query: query.q,
						localizationLanguages: query.localizationLanguages,
						realmId: query.realmId,
						limit: query.limit ?? 10,
					}),
				}),
			)
			.get(
				"/:tagId/expressions",
				{
					params: TagIdParams,
					query: TagConceptExpressionsQuery,
					response: { [StatusCodes.OK]: TagConceptExpressionsResponse },
					detail: {
						summary: "List direct, qualified, and inferred Expression uses of a Tag",
						tags: ["Tags"],
					},
				},
				({ params, query }) =>
					listTagConceptExpressions({
						tagId: params.tagId,
						localizationLanguages: query.localizationLanguages,
						limit: query.limit ?? 30,
					}),
			)
			.get(
				"/:tagId/hierarchy",
				{
					params: TagIdParams,
					query: TagHierarchyQuery,
					response: {
						[StatusCodes.OK]: TagHierarchyResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagNotFound"]),
					},
					detail: { summary: "Get typed child relations for a Tag", tags: ["Tags"] },
				},
				({ params, query }) =>
					getTagHierarchy({
						tagId: params.tagId,
						localizationLanguages: query.localizationLanguages,
						childLimit: query.childLimit ?? 30,
						grandchildLimit: query.grandchildLimit ?? 12,
					}),
			)
			.get(
				"/:tagId/paths",
				{
					params: TagIdParams,
					query: TagPathsContainingQuery,
					response: { [StatusCodes.OK]: TagPathsContainingResponse },
					detail: { summary: "List accepted structural Paths containing a Tag", tags: ["Tags"] },
				},
				async ({ params, query }) =>
					listAcceptedTagPathsContaining({
						tagId: params.tagId,
						localizationLanguages: query.localizationLanguages,
						limit: query.limit ?? 20,
						cursor: query.cursor,
					}),
			),
	)
	.group("/tag-expressions", (app) =>
		app
			.post(
				"",
				{
					access: "session-only",
					body: CreateTagExpressionBody,
					response: {
						[StatusCodes.OK]: CreateTagExpressionResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
					},
					detail: { summary: "Create an immutable Tag Expression", tags: ["Tags"] },
				},
				async ({ authorization, body, profile }) => {
					await authorization.platform.ensureCapability("unit.merge.propose");
					try {
						return await createTagExpression({ ...body, profileId: profile.unitId });
					} catch (error) {
						return asValidationError(error, "expression");
					}
				},
			)
			.post(
				"/:expressionId/inference-rules",
				{
					access: "session-only",
					params: TagExpressionParams,
					body: CreateTagExpressionInferenceRuleBody,
					response: {
						[StatusCodes.OK]: CreateTagExpressionInferenceRuleResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
					},
					detail: { summary: "Add a governed Tag Expression inference rule", tags: ["Tags"] },
				},
				async ({ authorization, body, params, profile }) => {
					await authorization.platform.ensureCapability("unit.merge.propose");
					try {
						return await createTagExpressionInferenceRule({
							...body,
							sourceExpressionId: params.expressionId,
							profileId: profile.unitId,
						});
					} catch (error) {
						return asValidationError(error, "inferenceRule");
					}
				},
			)
			.delete(
				"/:expressionId/inference-rules/:ruleId",
				{
					access: "session-only",
					params: TagExpressionInferenceRuleParams,
					response: {
						[StatusCodes.OK]: RetireTagExpressionInferenceRuleResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
					},
					detail: { summary: "Retire a Tag Expression inference-rule revision", tags: ["Tags"] },
				},
				async ({ authorization, params }) => {
					await authorization.platform.ensureCapability("unit.merge.propose");
					try {
						return await retireTagExpressionInferenceRule({
							sourceExpressionId: params.expressionId,
							ruleId: params.ruleId,
						});
					} catch (error) {
						return asValidationError(error, "inferenceRule");
					}
				},
			),
	)
	.group("/tag-relations", (app) =>
		app.post(
			"",
			{
				access: "contribute:unit:create",
				body: CreateTagRelationBody,
				response: {
					[StatusCodes.OK]: CreateTagRelationResponse,
					[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagNotFound"]),
					[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
				},
				detail: { summary: "Create or find a typed vocabulary relation", tags: ["Tags"] },
			},
			({ body, profile }) => createTagRelation({ ...body, profileId: profile.unitId }),
		),
	)
	.group("/tag-paths", (app) =>
		app
			.post(
				"/definition-warnings",
				{
					access: "contribute:unit:create",
					body: TagPathDefinitionWarningsBody,
					response: {
						[StatusCodes.OK]: TagPathDefinitionWarningsResponse,
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
					},
					detail: { summary: "Check related structural Path definitions", tags: ["Tags"] },
				},
				async ({ body }) => ({
					items: await listTagPathDefinitionWarnings({
						memberNodeIds: body.memberNodeIds,
						relationIds: body.relationIds,
						localizationLanguages: body.localizationLanguages,
						limit: body.limit ?? 10,
					}),
				}),
			)
			.delete(
				"/:pathId/senses/:senseId",
				{
					access: "session-only",
					params: TagPathSenseParams,
					response: {
						[StatusCodes.OK]: RetireTagPathSenseResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
					},
					detail: { summary: "Retire an immutable Path Sense", tags: ["Tags"] },
				},
				async ({ authorization, params }) => {
					await authorization.platform.ensureCapability("unit.merge.propose");
					return retireTagPathSense(params);
				},
			)
			.get(
				"/search",
				{
					access: "session-only",
					query: TagPathCurationSearchQuery,
					response: { [StatusCodes.OK]: TagPathCurationSearchResponse },
					detail: { summary: "Search explicit Path Senses for curation", tags: ["Tags"] },
				},
				async ({ query }) => ({
					items: await searchTagPathsForCuration({
						query: query.q,
						localizationLanguages: query.localizationLanguages,
						limit: query.limit ?? 10,
					}),
				}),
			)
			.post(
				"",
				{
					access: "contribute:unit:create",
					body: CreateTagPathBody,
					response: {
						[StatusCodes.OK]: CreateTagPathResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagNotFound"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Create or find an immutable structural Tag Path", tags: ["Tags"] },
				},
				({ body, profile }) =>
					createTagPath({
						memberNodeIds: body.memberNodeIds,
						relationIds: body.relationIds,
						profileId: profile.unitId,
					}),
			)
			.get(
				"/:pathId",
				{
					params: TagPathParams,
					query: TagPathQuery,
					response: {
						[StatusCodes.OK]: TagPathResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
					},
					detail: { summary: "Get Path structure and explicit Senses", tags: ["Tags"] },
				},
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					return getTagPath({
						pathId: params.pathId,
						viewerProfileId: identity.profile?.unitId,
						localizationLanguages: query.localizationLanguages,
					});
				},
			)
			.post(
				"/:pathId/senses",
				{
					access: "session-only",
					params: TagPathParams,
					body: CreateTagPathSenseBody,
					response: {
						[StatusCodes.OK]: CreateTagPathSenseResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
					},
					detail: { summary: "Create an explicit Path Sense", tags: ["Tags"] },
				},
				async ({ authorization, body, params, profile }) => {
					await authorization.platform.ensureCapability("unit.merge.propose");
					return createTagPathSense({
						...body,
						pathId: params.pathId,
						profileId: profile.unitId,
					});
				},
			)
			.put(
				"/:pathId/vote",
				{
					access: "contribute:interaction:write",
					params: TagPathParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: VoteSummaryResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Vote on structural Path validity", tags: ["Tags"] },
				},
				({ body, params, profile }) =>
					voteTagPath({ pathId: params.pathId, profileId: profile.unitId, value: body.value }),
			)
			.delete(
				"/:pathId/vote",
				{
					access: "write:interaction:write",
					params: TagPathParams,
					response: { [StatusCodes.OK]: VoteSummaryResponse },
					detail: { summary: "Remove a structural Path vote", tags: ["Tags"] },
				},
				({ params, profile }) =>
					deleteTagPathVote({ pathId: params.pathId, profileId: profile.unitId }),
			)
			.post(
				"/merges",
				{
					access: "session-only",
					body: CreateTagPathMergeBody,
					response: {
						[StatusCodes.OK]: TagPathMergeResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPathMerge"]),
					},
					detail: { summary: "Propose a governed structural Path merge", tags: ["Tags"] },
				},
				async ({ authorization, body, profile }) => {
					await authorization.platform.ensureCapability("unit.merge.propose");
					return proposeTagPathMerge({
						sourcePathId: body.sourcePathId,
						targetPathId: body.targetPathId,
						reason: body.reason,
						proposalSourceKind: body.proposalSource.kind,
						proposalProvenance:
							body.proposalSource.kind === "assisted" ? body.proposalSource : undefined,
						profileId: profile.unitId,
					});
				},
			)
			.get(
				"/merges/pending",
				{
					access: "session-only",
					query: ListPendingTagPathMergesQuery,
					response: {
						[StatusCodes.OK]: PendingTagPathMergeListResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
					},
					detail: { summary: "List pending structural Path merge proposals", tags: ["Tags"] },
				},
				async ({ authorization, query }) => {
					await authorization.platform.ensureCapability("unit.merge.review");
					return {
						items: await listPendingTagPathMerges({
							localizationLanguages: query.localizationLanguages,
							limit: query.limit ?? 50,
						}),
					};
				},
			)
			.put(
				"/merges/:mergeId/resolution",
				{
					access: "fresh-session-only",
					params: TagPathMergeParams,
					body: ResolveTagPathMergeBody,
					response: {
						[StatusCodes.OK]: TagPathMergeResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathMergeNotFound"]),
					},
					detail: { summary: "Resolve a structural Path merge proposal", tags: ["Tags"] },
				},
				async ({ authorization, body, params, profile }) => {
					await authorization.platform.ensureCapability("unit.merge.review");
					return resolveTagPathMerge({
						mergeId: params.mergeId,
						status: body.status,
						profileId: profile.unitId,
					});
				},
			),
	)
	.group("/units", (app) =>
		app
			.get(
				"/:type/:unitId/tags",
				{
					params: UnitTagLandscapeParams,
					query: UnitTagLandscapeQuery,
					response: {
						[StatusCodes.OK]: UnitTagLandscapeResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
					},
					detail: { summary: "Get visible Tag Expressions grouped by authority", tags: ["Tags"] },
				},
				async ({ params, query, request }) => {
					await checkUnitType(params.unitId, params.type);
					const identity = await resolveIdentity(request, "unit:read");
					await identity.authorization.unit.ensureCanRead(params.unitId, () => new UnitNotFound());
					return getUnitTagLandscape({
						unitId: params.unitId,
						viewerProfileId: identity.profile?.unitId,
						localizationLanguages: query.localizationLanguages,
						includeExpressions: query.includeExpressions ?? true,
						expressionLimit: query.expressionLimit ?? 50,
						sourceLimit: query.sourceLimit ?? 10,
						perRealmLimit: query.perRealmLimit ?? 12,
					});
				},
			)
			.post(
				"/:type/:unitId/tag-path-applications",
				{
					access: "contribute:interaction:write",
					params: UnitTagLandscapeParams,
					body: ApplyTagPathBody,
					response: {
						[StatusCodes.OK]: TagPathApplicationResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "TagPathNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Apply one explicit global Path Sense", tags: ["Tags"] },
				},
				async ({ authorization, body, params, profile }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					return applyTagPath({
						unitId: params.unitId,
						senseId: body.senseId,
						profileId: profile.unitId,
						fitVote: body.fitVote,
						spoilerLevel: body.spoilerLevel,
					});
				},
			)
			.delete(
				"/:type/:unitId/tag-path-applications/:applicationId",
				{
					access: "write:unit:update",
					params: TagPathApplicationParams,
					response: {
						[StatusCodes.OK]: TagPathApplicationRemovalResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathApplicationNotFound"]),
					},
					detail: { summary: "Remove one global Path Application", tags: ["Tags"] },
				},
				async ({ authorization, params }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensure(params.unitId, "unit.tag-curation.manage");
					return removeTagPathApplication({
						unitId: params.unitId,
						applicationId: params.applicationId,
					});
				},
			)
			.put(
				"/:type/:unitId/tag-path-applications/:applicationId/judgment",
				{
					access: "contribute:interaction:write",
					params: TagPathApplicationParams,
					body: TagPathApplicationJudgmentBody,
					response: {
						[StatusCodes.OK]: TagPathApplicationJudgmentResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathApplicationNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Judge one global semantic Application", tags: ["Tags"] },
				},
				async ({ authorization, body, params, profile }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					return judgeTagPathApplication({
						applicationId: params.applicationId,
						unitId: params.unitId,
						profileId: profile.unitId,
						...body,
					});
				},
			)
			.delete(
				"/:type/:unitId/tag-path-applications/:applicationId/judgment",
				{
					access: "write:interaction:write",
					params: TagPathApplicationParams,
					response: {
						[StatusCodes.OK]: TagPathApplicationJudgmentResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathApplicationNotFound"]),
					},
					detail: { summary: "Clear one global Application judgment", tags: ["Tags"] },
				},
				async ({ authorization, params, profile }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					return clearTagPathApplicationJudgment({
						applicationId: params.applicationId,
						unitId: params.unitId,
						profileId: profile.unitId,
					});
				},
			),
	)
	.group("/realms", (app) =>
		app
			.get(
				"/:realmId/tag-paths",
				{
					params: RealmTagSubscriptionParams,
					query: ListRealmTagPathsQuery,
					response: {
						[StatusCodes.OK]: RealmTagPathListResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmNotFound"]),
					},
					detail: { summary: "List structural Paths adopted by a Realm", tags: ["Realms", "Tags"] },
				},
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					await identity.authorization.unit.ensureCanRead(
						params.realmId,
						() => new RealmNotFound(),
					);
					return listRealmTagPaths({
						realmId: params.realmId,
						viewerProfileId: identity.profile?.unitId,
						localizationLanguages: query.localizationLanguages,
						limit: query.limit ?? 50,
					});
				},
			)
			.put(
				"/:realmId/tag-paths/:pathId",
				{
					access: "session-only",
					params: RealmTagPathParams,
					response: {
						[StatusCodes.OK]: RealmTagPathAdoptionResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
					},
					detail: {
						summary: "Adopt structural Path identity in a Realm",
						tags: ["Realms", "Tags"],
					},
				},
				async ({ authorization, params, profile }) => {
					await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
					return adoptRealmTagPath({ ...params, profileId: profile.unitId });
				},
			)
			.put(
				"/:realmId/tag-path-senses/:senseId",
				{
					access: "session-only",
					params: RealmTagPathSenseParams,
					response: {
						[StatusCodes.OK]: RealmTagPathSenseAdoptionResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
					},
					detail: { summary: "Adopt an explicit Path Sense in a Realm", tags: ["Realms", "Tags"] },
				},
				async ({ authorization, params, profile }) => {
					await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
					return adoptRealmTagPathSense({ ...params, profileId: profile.unitId });
				},
			)
			.put(
				"/:realmId/tag-paths/:pathId/vote",
				{
					access: "contribute:interaction:write",
					params: RealmTagPathParams,
					body: VoteBody,
					response: { [StatusCodes.OK]: RealmTagPathVoteResponse },
					detail: { summary: "Vote on Realm-local structural validity", tags: ["Realms", "Tags"] },
				},
				async ({ authorization, body, params, profile }) => {
					await authorization.realm.ensureParticipation(params.realmId);
					return voteRealmTagPath({ ...params, profileId: profile.unitId, value: body.value });
				},
			)
			.delete(
				"/:realmId/tag-paths/:pathId/vote",
				{
					access: "write:interaction:write",
					params: RealmTagPathParams,
					response: { [StatusCodes.OK]: RealmTagPathVoteResponse },
					detail: { summary: "Remove a Realm-local structural vote", tags: ["Realms", "Tags"] },
				},
				async ({ authorization, params, profile }) => {
					await authorization.realm.ensureParticipation(params.realmId);
					return deleteRealmTagPathVote({ ...params, profileId: profile.unitId });
				},
			)
			.post(
				"/:realmId/units/:unitId/tag-path-applications",
				{
					access: "session-only",
					params: RealmApplyTagPathParams,
					body: ApplyTagPathBody,
					response: {
						[StatusCodes.OK]: RealmTagPathApplicationResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"TagPathNotFound",
							"TagPathApplicationNotFound",
						]),
					},
					detail: { summary: "Apply one adopted Realm Path Sense", tags: ["Realms", "Tags"] },
				},
				async ({ authorization, body, params, profile }) => {
					await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
					await authorization.unit.ensureCanRead(params.unitId);
					return applyRealmTagPath({
						...params,
						senseId: body.senseId,
						profileId: profile.unitId,
						fitVote: body.fitVote,
						spoilerLevel: body.spoilerLevel,
					});
				},
			)
			.delete(
				"/:realmId/units/:unitId/tag-path-applications/:applicationId",
				{
					access: "session-only",
					params: RealmTagPathApplicationParams,
					response: {
						[StatusCodes.OK]: RealmTagPathApplicationRemovalResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathApplicationNotFound"]),
					},
					detail: { summary: "Remove one Realm semantic Application", tags: ["Realms", "Tags"] },
				},
				async ({ authorization, params }) => {
					await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
					await authorization.unit.ensureCanRead(params.unitId);
					return removeRealmTagPathApplication(params);
				},
			)
			.put(
				"/:realmId/units/:unitId/tag-path-applications/:applicationId/judgment",
				{
					access: "contribute:interaction:write",
					params: RealmTagPathApplicationParams,
					body: TagPathApplicationJudgmentBody,
					response: {
						[StatusCodes.OK]: RealmTagPathApplicationJudgmentResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathApplicationNotFound"]),
					},
					detail: { summary: "Judge one Realm semantic Application", tags: ["Realms", "Tags"] },
				},
				async ({ authorization, body, params, profile }) => {
					await authorization.realm.ensureParticipation(params.realmId);
					await authorization.unit.ensureCanRead(params.unitId);
					return judgeRealmTagPathApplication({ ...params, ...body, profileId: profile.unitId });
				},
			)
			.delete(
				"/:realmId/units/:unitId/tag-path-applications/:applicationId/judgment",
				{
					access: "write:interaction:write",
					params: RealmTagPathApplicationParams,
					response: {
						[StatusCodes.OK]: RealmTagPathApplicationJudgmentResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathApplicationNotFound"]),
					},
					detail: { summary: "Clear one Realm Application judgment", tags: ["Realms", "Tags"] },
				},
				async ({ authorization, params, profile }) => {
					await authorization.realm.ensureParticipation(params.realmId);
					await authorization.unit.ensureCanRead(params.unitId);
					return clearRealmTagPathApplicationJudgment({
						...params,
						profileId: profile.unitId,
					});
				},
			)
			.put(
				"/:realmId/tag-path-policy",
				{
					access: "write:realm:manage",
					params: RealmTagSubscriptionParams,
					body: RealmTagPathFallbackBody,
					response: {
						[StatusCodes.OK]: RealmTagPathFallbackResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmNotFound"]),
					},
					detail: { summary: "Set independent Realm fallback policies", tags: ["Realms", "Tags"] },
				},
				async ({ authorization, body, params }) => {
					await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
					return updateRealmTagPathFallbackPolicy({ realmId: params.realmId, ...body });
				},
			),
	)
	.group("/users", (app) =>
		app
			.get(
				"/me/tag-realm-subscriptions",
				{
					access: "interaction:read",
					query: RealmTagSubscriptionListQuery,
					response: { [StatusCodes.OK]: RealmTagSubscriptionListResponse },
					detail: { summary: "List ordered Realm Tag authorities", tags: ["Tags"] },
				},
				async ({ profile, query }) => ({
					items: await listRealmTagSubscriptions({
						profileId: profile.unitId,
						localizationLanguages: query.localizationLanguages,
					}),
				}),
			)
			.put(
				"/me/tag-realm-subscriptions/:realmId",
				{
					access: "contribute:interaction:write",
					params: RealmTagSubscriptionParams,
					query: RealmTagSubscriptionListQuery,
					body: UpsertRealmTagSubscriptionBody,
					response: {
						[StatusCodes.OK]: RealmTagSubscriptionResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmNotFound"]),
					},
					detail: { summary: "Subscribe to or reorder a Realm Tag authority", tags: ["Tags"] },
				},
				async ({ authorization, body, params, profile, query }) => {
					const [, [record]] = await Promise.all([
						authorization.unit.ensureCanRead(params.realmId, () => new RealmNotFound()),
						database
							.select({ id: realm.id })
							.from(realm)
							.where(eq(realm.id, params.realmId))
							.limit(1),
					]);
					if (!record) throw new RealmNotFound();
					return upsertRealmTagSubscription({
						profileId: profile.unitId,
						realmId: params.realmId,
						position: body.position,
						localizationLanguages: query.localizationLanguages,
					});
				},
			)
			.delete(
				"/me/tag-realm-subscriptions/:realmId",
				{
					access: "write:interaction:write",
					params: RealmTagSubscriptionParams,
					response: { [StatusCodes.OK]: RealmTagSubscriptionStateResponse },
					detail: { summary: "Unsubscribe from a Realm Tag authority", tags: ["Tags"] },
				},
				async ({ params, profile }) => {
					await deleteRealmTagSubscription(profile.unitId, params.realmId);
					return { realmId: params.realmId, subscribed: false as const };
				},
			),
	);
