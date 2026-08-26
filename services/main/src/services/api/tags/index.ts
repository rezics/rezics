import { StatusCodes } from "http-status-codes";
import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { realm } from "../../database/schema";
import {
	deleteRealmTagSubscription,
	getUnitTagLandscape,
	listRealmTagSubscriptions,
	upsertRealmTagSubscription,
} from "../../tags/service";
import {
	applyTagPath,
	applyRealmTagPath,
	adoptRealmTagPath,
	clearRealmTagPathApplicationJudgment,
	createTagPath,
	clearTagPathApplicationJudgment,
	deleteTagPathVote,
	deleteRealmTagPathVote,
	getTagHierarchy,
	getTagPath,
	listTagPathDefinitionWarnings,
	listRankedTagPathsEndingAt,
	listPendingTagPathMerges,
	listRealmTagPaths,
	proposeTagPathMerge,
	removeTagPathApplication,
	removeRealmTagPathApplication,
	resolveTagPathMerge,
	suggestTagsFromCompoundPath,
	suggestTags,
	searchTagPathsForCuration,
	judgeRealmTagPathApplication,
	updateRealmTagPathFallbackPolicy,
	voteRealmTagPath,
	voteTagPath,
	judgeTagPathApplication,
} from "../../tag-paths/service";
import { UnitNotFound } from "../../units/errors";
import { checkUnitType } from "../unit-resources/service";
import { RealmNotFound } from "../realms/errors";
import { toApiErrorResponse, VoteBackpressureResponse } from "../schema/response";
import {
	RealmTagSubscriptionListQuery,
	RealmTagSubscriptionListResponse,
	RealmTagSubscriptionParams,
	RealmTagSubscriptionResponse,
	RealmTagSubscriptionStateResponse,
	ListPendingTagPathMergesQuery,
	ListRealmTagPathsQuery,
	PendingTagPathMergeListResponse,
	RealmTagPathFallbackBody,
	RealmTagPathFallbackResponse,
	RealmTagPathJudgmentBody,
	RealmTagPathListResponse,
	RealmTagPathMutationResponse,
	RealmTagPathParams,
	RealmUnitTagPathMutationResponse,
	RealmUnitTagPathParams,
	CreateTagPathBody,
	CreateTagPathMergeBody,
	CreateTagPathResponse,
	TagPathDefinitionWarningsBody,
	TagPathDefinitionWarningsResponse,
	TagEndingPathsQuery,
	TagEndingPathsResponse,
	TagHierarchyQuery,
	TagHierarchyResponse,
	TagIdParams,
	TagPathApplicationResponse,
	TagPathApplicationJudgmentBody,
	TagPathCurationSearchQuery,
	TagPathCurationSearchResponse,
	TagPathMergeParams,
	TagPathMergeResponse,
	TagPathParams,
	TagPathQuery,
	TagPathResponse,
	TagSuggestionQuery,
	TagSuggestionResponse,
	ResolveTagPathMergeBody,
	UnitTagPathParams,
	UnitTagLandscapeParams,
	UnitTagLandscapeQuery,
	UnitTagLandscapeResponse,
	UpsertRealmTagSubscriptionBody,
	VoteBody,
	VoteSummaryResponse,
} from "./schema";

export default new Elysia()
	.use(session)
	.group("/tags", (app) =>
		app
			.get(
				"/suggestions",
				async ({ query }) => ({
					items: await suggestTags({
						query: query.q,
						localizationLanguages: query.localizationLanguages,
						limit: query.limit ?? 10,
					}),
				}),
				{
					query: TagSuggestionQuery,
					response: { [StatusCodes.OK]: TagSuggestionResponse },
					detail: {
						summary: "Suggest terminal Tags from a compound Tag query",
						tags: ["Tags"],
					},
				},
			)
			.get(
				"/:tagId/hierarchy",
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					return getTagHierarchy({
						tagId: params.tagId,
						authorization: identity.authorization.unit,
						localizationLanguages: query.localizationLanguages,
						childLimit: query.childLimit ?? 30,
						grandchildLimit: query.grandchildLimit ?? 12,
					});
				},
				{
					params: TagIdParams,
					query: TagHierarchyQuery,
					response: {
						[StatusCodes.OK]: TagHierarchyResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagNotFound"]),
					},
					detail: {
						summary: "Get a Tag with direct children and grandchildren",
						tags: ["Tags"],
					},
				},
			)
			.get(
				"/:tagId/paths",
				async ({ params, query }) => ({
					items: await listRankedTagPathsEndingAt({
						tagId: params.tagId,
						localizationLanguages: query.localizationLanguages,
						limit: query.limit ?? 5,
					}),
				}),
				{
					params: TagIdParams,
					query: TagEndingPathsQuery,
					response: { [StatusCodes.OK]: TagEndingPathsResponse },
					detail: { summary: "List accepted Tag Paths ending at a Tag", tags: ["Tags"] },
				},
			),
	)
	.group("/tag-paths", (app) =>
		app
			.post(
				"/definition-warnings",
				async ({ body }) => ({
					items: await listTagPathDefinitionWarnings({
						memberTagIds: body.memberTagIds,
						localizationLanguages: body.localizationLanguages,
						limit: body.limit ?? 10,
					}),
				}),
				{
					access: "contribute:unit:create",
					body: TagPathDefinitionWarningsBody,
					response: {
						[StatusCodes.OK]: TagPathDefinitionWarningsResponse,
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
					},
					detail: {
						summary: "List related accepted definitions before creating a Tag Path",
						tags: ["Tags"],
					},
				},
			)
			.get(
				"/search",
				async ({ query }) => ({
					items: await searchTagPathsForCuration({
						query: query.q,
						localizationLanguages: query.localizationLanguages,
						limit: query.limit ?? 10,
					}),
				}),
				{
					access: "session-only",
					query: TagPathCurationSearchQuery,
					response: { [StatusCodes.OK]: TagPathCurationSearchResponse },
					detail: { summary: "Search accepted Tag Paths for curation", tags: ["Tags"] },
				},
			)
			.post(
				"",
				async ({ body, profile }) => {
					return createTagPath({
						memberTagIds: body.memberTagIds,
						profileId: profile.unitId,
					});
				},
				{
					access: "contribute:unit:create",
					body: CreateTagPathBody,
					response: {
						[StatusCodes.OK]: CreateTagPathResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagNotFound"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: {
						summary: "Create or find and upvote an immutable Tag Path",
						tags: ["Tags"],
					},
				},
			)
			.get(
				"/:pathId",
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					return getTagPath({
						pathId: params.pathId,
						viewerProfileId: identity.profile?.unitId,
						localizationLanguages: query.localizationLanguages,
					});
				},
				{
					params: TagPathParams,
					query: TagPathQuery,
					response: {
						[StatusCodes.OK]: TagPathResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
					},
					detail: { summary: "Get a Tag Path", tags: ["Tags"] },
				},
			)
			.put(
				"/:pathId/vote",
				async ({ params, body, profile }) => {
					return voteTagPath({
						pathId: params.pathId,
						profileId: profile.unitId,
						value: body.value,
					});
				},
				{
					access: "contribute:interaction:write",
					params: TagPathParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: VoteSummaryResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Vote on a Tag Path definition", tags: ["Tags"] },
				},
			)
			.delete(
				"/:pathId/vote",
				async ({ params, profile }) => {
					return deleteTagPathVote({
						pathId: params.pathId,
						profileId: profile.unitId,
					});
				},
				{
					access: "write:interaction:write",
					params: TagPathParams,
					response: {
						[StatusCodes.OK]: VoteSummaryResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Remove a Tag Path definition vote", tags: ["Tags"] },
				},
			)
			.post(
				"/merges",
				async ({ authorization, body, profile }) => {
					await authorization.platform.ensureCapability("unit.merge.propose");
					return proposeTagPathMerge({ ...body, profileId: profile.unitId });
				},
				{
					access: "session-only",
					body: CreateTagPathMergeBody,
					response: {
						[StatusCodes.OK]: TagPathMergeResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPathMerge"]),
					},
					detail: { summary: "Propose a manually governed Tag Path merge", tags: ["Tags"] },
				},
			)
			.get(
				"/merges/pending",
				async ({ authorization, query }) => {
					await authorization.platform.ensureCapability("unit.merge.review");
					return listPendingTagPathMerges({
						localizationLanguages: query.localizationLanguages,
						limit: query.limit ?? 50,
					});
				},
				{
					access: "session-only",
					query: ListPendingTagPathMergesQuery,
					response: {
						[StatusCodes.OK]: PendingTagPathMergeListResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
					},
					detail: {
						summary: "List pending manual Tag Path merge proposals",
						tags: ["Tags"],
					},
				},
			)
			.put(
				"/merges/:mergeId/resolution",
				async ({ authorization, body, params, profile }) => {
					await authorization.platform.ensureCapability("unit.merge.review");
					return resolveTagPathMerge({
						mergeId: params.mergeId,
						resolution: body.resolution,
						profileId: profile.unitId,
					});
				},
				{
					access: "fresh-session-only",
					params: TagPathMergeParams,
					body: ResolveTagPathMergeBody,
					response: {
						[StatusCodes.OK]: TagPathMergeResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathMergeNotFound"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPathMerge"]),
					},
					detail: { summary: "Resolve a Tag Path merge proposal", tags: ["Tags"] },
				},
			),
	)
	.group("/units", (app) =>
		app
			.get(
				"/:type/:unitId/tags",
				async ({ params, query, request }) => {
					await checkUnitType(params.unitId, params.type);
					const identity = await resolveIdentity(request, "unit:read");
					await identity.authorization.unit.ensureCanRead(params.unitId, () => new UnitNotFound());
					return getUnitTagLandscape({
						unitId: params.unitId,
						viewerProfileId: identity.profile?.unitId,
						localizationLanguages: query.localizationLanguages,
						globalLimit: query.globalLimit ?? 50,
						includePaths: true,
						pathLimit: query.pathLimit ?? 20,
						sourceLimit: query.sourceLimit ?? 10,
						perRealmLimit: query.perRealmLimit ?? 12,
					});
				},
				{
					params: UnitTagLandscapeParams,
					query: UnitTagLandscapeQuery,
					response: {
						[StatusCodes.OK]: UnitTagLandscapeResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
					},
					detail: {
						summary: "Get global and subscribed Realm Tag assertions for a Unit",
						tags: ["Tags"],
					},
				},
			)
			.put(
				"/:type/:unitId/tag-paths/:pathId",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					return applyTagPath({
						unitId: params.unitId,
						pathId: params.pathId,
						profileId: profile.unitId,
					});
				},
				{
					access: "contribute:interaction:write",
					params: UnitTagPathParams,
					response: {
						[StatusCodes.OK]: TagPathApplicationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "TagPathNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Apply a Tag Path to a Unit", tags: ["Tags"] },
				},
			)
			.delete(
				"/:type/:unitId/tag-paths/:pathId",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensure(params.unitId, "unit.tag-curation.manage");
					await removeTagPathApplication({
						unitId: params.unitId,
						pathId: params.pathId,
						profileId: profile.unitId,
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:update",
					params: UnitTagPathParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"PlatformCapabilityRequired",
							"UnitPermissionForbidden",
							"UnitAccessRestricted",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagPathApplicationNotFound",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Remove a Tag Path from a Unit", tags: ["Tags"] },
				},
			)
			.put(
				"/:type/:unitId/tag-paths/:pathId/judgment",
				async ({ params, body, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					return judgeTagPathApplication({
						unitId: params.unitId,
						pathId: params.pathId,
						profileId: profile.unitId,
						fitVote: body.fitVote,
						spoilerLevel: body.spoilerLevel,
					});
				},
				{
					access: "contribute:interaction:write",
					params: UnitTagPathParams,
					body: TagPathApplicationJudgmentBody,
					response: {
						[StatusCodes.OK]: TagPathApplicationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagPathApplicationNotFound",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Judge Tag Path fit or spoiler for a Unit", tags: ["Tags"] },
				},
			)
			.delete(
				"/:type/:unitId/tag-paths/:pathId/judgment",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					return clearTagPathApplicationJudgment({
						unitId: params.unitId,
						pathId: params.pathId,
						profileId: profile.unitId,
					});
				},
				{
					access: "write:interaction:write",
					params: UnitTagPathParams,
					response: {
						[StatusCodes.OK]: TagPathApplicationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagPathApplicationNotFound",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Remove a Unit Tag Path judgment", tags: ["Tags"] },
				},
			),
	)
	.group("/realms", (app) =>
		app
			.get(
				"/:realmId/tag-paths",
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					await identity.authorization.unit.ensureCanRead(
						params.realmId,
						() => new RealmNotFound(),
					);
					if (query.unitId)
						await identity.authorization.unit.ensureCanRead(query.unitId, () => new UnitNotFound());
					return listRealmTagPaths({
						realmId: params.realmId,
						unitId: query.unitId,
						viewerProfileId: identity.profile?.unitId,
						localizationLanguages: query.localizationLanguages,
						limit: query.limit ?? 50,
					});
				},
				{
					params: RealmTagSubscriptionParams,
					query: ListRealmTagPathsQuery,
					response: {
						[StatusCodes.OK]: RealmTagPathListResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmNotFound", "UnitNotFound"]),
					},
					detail: {
						summary: "List Realm Tag Paths with independent authority resolution",
						tags: ["Realms", "Tags"],
					},
				},
			)
			.put(
				"/:realmId/tag-paths/:pathId",
				async ({ params, profile, authorization }) => {
					await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
					return adoptRealmTagPath({ ...params, profileId: profile.unitId });
				},
				{
					access: "session-only",
					params: RealmTagPathParams,
					response: {
						[StatusCodes.OK]: RealmTagPathMutationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Adopt a Tag Path in a Realm", tags: ["Realms", "Tags"] },
				},
			)
			.put(
				"/:realmId/tag-paths/:pathId/vote",
				async ({ params, body, profile, authorization }) => {
					await authorization.realm.ensureParticipation(params.realmId);
					return voteRealmTagPath({
						...params,
						profileId: profile.unitId,
						value: body.value,
					});
				},
				{
					access: "contribute:interaction:write",
					params: RealmTagPathParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: RealmTagPathMutationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: {
						summary: "Vote on a Realm Tag Path definition",
						tags: ["Realms", "Tags"],
					},
				},
			)
			.delete(
				"/:realmId/tag-paths/:pathId/vote",
				async ({ params, profile, authorization }) => {
					await authorization.realm.ensureParticipation(params.realmId);
					return deleteRealmTagPathVote({
						...params,
						profileId: profile.unitId,
					});
				},
				{
					access: "write:interaction:write",
					params: RealmTagPathParams,
					response: {
						[StatusCodes.OK]: RealmTagPathMutationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: {
						summary: "Remove a Realm Tag Path definition vote",
						tags: ["Realms", "Tags"],
					},
				},
			)
			.put(
				"/:realmId/units/:unitId/tag-paths/:pathId",
				async ({ params, profile, authorization }) => {
					await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
					await authorization.unit.ensureCanRead(params.unitId);
					return applyRealmTagPath({ ...params, profileId: profile.unitId });
				},
				{
					access: "session-only",
					params: RealmUnitTagPathParams,
					response: {
						[StatusCodes.OK]: RealmUnitTagPathMutationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"RealmCapabilityRequired",
							"UnitAccessRestricted",
							"UnitPermissionForbidden",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"TagPathApplicationNotFound",
							"TagPathNotFound",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: {
						summary: "Apply an adopted Tag Path to a Realm Unit",
						tags: ["Realms", "Tags"],
					},
				},
			)
			.delete(
				"/:realmId/units/:unitId/tag-paths/:pathId",
				async ({ params, authorization }) => {
					await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
					await authorization.unit.ensureCanRead(params.unitId);
					await removeRealmTagPathApplication(params);
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "session-only",
					params: RealmUnitTagPathParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"RealmCapabilityRequired",
							"UnitAccessRestricted",
							"UnitPermissionForbidden",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathApplicationNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: {
						summary: "Remove a Tag Path application from a Realm Unit",
						tags: ["Realms", "Tags"],
					},
				},
			)
			.put(
				"/:realmId/units/:unitId/tag-paths/:pathId/judgment",
				async ({ params, body, profile, authorization }) => {
					await authorization.realm.ensureParticipation(params.realmId);
					await authorization.unit.ensureCanRead(params.unitId);
					return judgeRealmTagPathApplication({
						...params,
						...body,
						profileId: profile.unitId,
					});
				},
				{
					access: "contribute:interaction:write",
					params: RealmUnitTagPathParams,
					body: RealmTagPathJudgmentBody,
					response: {
						[StatusCodes.OK]: RealmUnitTagPathMutationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"RealmCapabilityRequired",
							"UnitAccessRestricted",
							"UnitPermissionForbidden",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagPathApplicationNotFound"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: {
						summary: "Judge Realm-local Tag Path fit or spoiler",
						tags: ["Realms", "Tags"],
					},
				},
			)
			.delete(
				"/:realmId/units/:unitId/tag-paths/:pathId/judgment",
				async ({ params, profile, authorization }) => {
					await authorization.realm.ensureParticipation(params.realmId);
					await authorization.unit.ensureCanRead(params.unitId);
					return clearRealmTagPathApplicationJudgment({
						...params,
						profileId: profile.unitId,
					});
				},
				{
					access: "write:interaction:write",
					params: RealmUnitTagPathParams,
					response: {
						[StatusCodes.OK]: RealmUnitTagPathMutationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"RealmCapabilityRequired",
							"UnitAccessRestricted",
							"UnitPermissionForbidden",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: {
						summary: "Clear a Realm-local Tag Path judgment",
						tags: ["Realms", "Tags"],
					},
				},
			)
			.put(
				"/:realmId/tag-path-policy",
				async ({ params, body, authorization }) => {
					await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
					return updateRealmTagPathFallbackPolicy({ realmId: params.realmId, ...body });
				},
				{
					access: "write:realm:manage",
					params: RealmTagSubscriptionParams,
					body: RealmTagPathFallbackBody,
					response: {
						[StatusCodes.OK]: RealmTagPathFallbackResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmNotFound"]),
					},
					detail: {
						summary: "Update independent Realm Tag Path fallback policies",
						tags: ["Realms", "Tags"],
					},
				},
			),
	)
	.group("/users", (app) =>
		app
			.get(
				"/me/tag-realm-subscriptions",
				async ({ profile, query }) => ({
					items: await listRealmTagSubscriptions({
						profileId: profile.unitId,
						localizationLanguages: query.localizationLanguages,
					}),
				}),
				{
					access: "interaction:read",
					query: RealmTagSubscriptionListQuery,
					response: { [StatusCodes.OK]: RealmTagSubscriptionListResponse },
					detail: {
						summary: "List the current user's ordered Realm Tag sources",
						tags: ["Tags"],
					},
				},
			)
			.put(
				"/me/tag-realm-subscriptions/:realmId",
				async ({ profile, authorization, params, query, body }) => {
					const [, [realmRecord]] = await Promise.all([
						authorization.unit.ensureCanRead(params.realmId, () => new RealmNotFound()),
						database
							.select({ id: realm.id })
							.from(realm)
							.where(eq(realm.id, params.realmId))
							.limit(1),
					]);
					if (!realmRecord) throw new RealmNotFound();
					return upsertRealmTagSubscription({
						profileId: profile.unitId,
						realmId: params.realmId,
						position: body.position,
						localizationLanguages: query.localizationLanguages,
					});
				},
				{
					access: "contribute:interaction:write",
					params: RealmTagSubscriptionParams,
					query: RealmTagSubscriptionListQuery,
					body: UpsertRealmTagSubscriptionBody,
					response: {
						[StatusCodes.OK]: RealmTagSubscriptionResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmNotFound"]),
					},
					detail: {
						summary: "Subscribe to or reorder a Realm Tag source",
						tags: ["Tags"],
					},
				},
			)
			.delete(
				"/me/tag-realm-subscriptions/:realmId",
				async ({ profile, params }) => {
					await deleteRealmTagSubscription(profile.unitId, params.realmId);
					return { realmId: params.realmId, subscribed: false };
				},
				{
					access: "write:interaction:write",
					params: RealmTagSubscriptionParams,
					response: { [StatusCodes.OK]: RealmTagSubscriptionStateResponse },
					detail: {
						summary: "Unsubscribe from a Realm Tag source",
						tags: ["Tags"],
					},
				},
			),
	);
