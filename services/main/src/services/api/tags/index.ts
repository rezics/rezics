import { DevelopmentPreviewCapability } from "@rezics/access";
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
	applyTagStructure,
	createTagStructure,
	deleteTagStructureApplicationVote,
	deleteTagStructureVote,
	getTagHierarchy,
	getTagStructure,
	removeTagStructureApplication,
	updateTagStructureDefinition,
	voteTagStructure,
	voteTagStructureApplication,
} from "../../tag-structures/service";
import { UnitNotFound } from "../../units/errors";
import { checkUnitType } from "../catalog/service";
import { RealmNotFound } from "../realms/errors";
import { toApiErrorResponse } from "../schema/response";
import {
	RealmTagSubscriptionListQuery,
	RealmTagSubscriptionListResponse,
	RealmTagSubscriptionParams,
	RealmTagSubscriptionResponse,
	RealmTagSubscriptionStateResponse,
	CreateTagStructureBody,
	CreateTagStructureResponse,
	TagHierarchyQuery,
	TagHierarchyResponse,
	TagIdParams,
	TagStructureApplicationResponse,
	TagStructureParams,
	TagStructureQuery,
	TagStructureResponse,
	UnitTagStructureParams,
	UnitTagLandscapeParams,
	UnitTagLandscapeQuery,
	UnitTagLandscapeResponse,
	UpdateTagStructureBody,
	UpsertRealmTagSubscriptionBody,
	VoteBody,
	VoteSummaryResponse,
} from "./schema";

export default new Elysia()
	.use(session)
	.group("/tags", (app) =>
		app.get(
			"/:tagId",
			async ({ params, query, request }) => {
				const identity = await resolveIdentity(request.headers, "unit:read");
				await identity.authorization.platform.ensureCapability(
					DevelopmentPreviewCapability,
				);
				return getTagHierarchy({
					tagId: params.tagId,
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
					[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
					[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagNotFound"]),
				},
				detail: {
					summary: "Get a Tag with direct children and grandchildren",
					tags: ["Tags"],
				},
			},
		),
	)
	.group("/tag-structures", (app) =>
		app
			.post(
				"",
				async ({ authorization, body, profile }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					return createTagStructure({
						memberTagIds: body.memberTagIds,
						profileId: profile.unitId,
					});
				},
				{
					access: "contribute:unit:create",
					body: CreateTagStructureBody,
					response: {
						[StatusCodes.OK]: CreateTagStructureResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagNotFound"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
							"InvalidTagStructure",
						]),
					},
					detail: {
						summary: "Create or find and upvote a community-immutable Tag structure",
						tags: ["Tags"],
					},
				},
			)
			.get(
				"/:structureId",
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request.headers, "unit:read");
					await identity.authorization.platform.ensureCapability(
						DevelopmentPreviewCapability,
					);
					return getTagStructure({
						structureId: params.structureId,
						viewerProfileId: identity.profile?.unitId,
						localizationLanguages: query.localizationLanguages,
					});
				},
				{
					params: TagStructureParams,
					query: TagStructureQuery,
					response: {
						[StatusCodes.OK]: TagStructureResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagStructureNotFound"]),
					},
					detail: { summary: "Get a Tag structure", tags: ["Tags"] },
				},
			)
			.put(
				"/:structureId",
				async ({ params, query, body, profile, authorization }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					await updateTagStructureDefinition({
						structureId: params.structureId,
						memberTagIds: body.memberTagIds,
						expectedUpdatedAt: body.updatedAt,
						reason: body.reason,
						actorProfileId: profile.unitId,
						authorization: authorization.platform,
					});
					return getTagStructure({
						structureId: params.structureId,
						viewerProfileId: profile.unitId,
						localizationLanguages: query.localizationLanguages,
					});
				},
				{
					access: "write:unit:update",
					params: TagStructureParams,
					query: TagStructureQuery,
					body: UpdateTagStructureBody,
					response: {
						[StatusCodes.OK]: TagStructureResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"TagNotFound",
							"TagStructureNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"TagStructureChanged",
							"TagStructureDefinitionConflict",
						]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
							"InvalidTagStructure",
						]),
					},
					detail: {
						summary: "Administratively correct a Tag structure definition",
						tags: ["Tags"],
					},
				},
			)
			.put(
				"/:structureId/vote",
				async ({ params, body, profile, authorization }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					return voteTagStructure({
						structureId: params.structureId,
						profileId: profile.unitId,
						value: body.value,
					});
				},
				{
					access: "contribute:interaction:write",
					params: TagStructureParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: VoteSummaryResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagStructureNotFound"]),
					},
					detail: { summary: "Vote on a Tag structure", tags: ["Tags"] },
				},
			)
			.delete(
				"/:structureId/vote",
				async ({ params, profile, authorization }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					return deleteTagStructureVote({
						structureId: params.structureId,
						profileId: profile.unitId,
					});
				},
				{
					access: "write:interaction:write",
					params: TagStructureParams,
					response: {
						[StatusCodes.OK]: VoteSummaryResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagStructureNotFound"]),
					},
					detail: { summary: "Remove a Tag structure vote", tags: ["Tags"] },
				},
			),
	)
	.group("/units", (app) =>
		app
			.get(
				"/:type/:unitId/tags",
				async ({ params, query, request }) => {
					await checkUnitType(params.unitId, params.type);
					const identity = await resolveIdentity(request.headers, "unit:read");
					await identity.authorization.unit.ensureCanRead(
						params.unitId,
						() => new UnitNotFound(),
					);
					const includeStructures = await identity.authorization.platform.hasCapability(
						DevelopmentPreviewCapability,
					);
					return getUnitTagLandscape({
						unitId: params.unitId,
						viewerProfileId: identity.profile?.unitId,
						localizationLanguages: query.localizationLanguages,
						globalLimit: query.globalLimit ?? 50,
						includeStructures,
						structureLimit: query.structureLimit ?? 20,
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
				"/:type/:unitId/tag-structures/:structureId",
				async ({ params, profile, authorization }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					return applyTagStructure({
						unitId: params.unitId,
						structureId: params.structureId,
						profileId: profile.unitId,
					});
				},
				{
					access: "contribute:interaction:write",
					params: UnitTagStructureParams,
					response: {
						[StatusCodes.OK]: TagStructureApplicationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
							"InvalidTagStructure",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagStructureNotFound",
						]),
					},
					detail: { summary: "Apply a Tag structure to a Unit", tags: ["Tags"] },
				},
			)
			.delete(
				"/:type/:unitId/tag-structures/:structureId",
				async ({ params, profile, authorization }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanUpdate(params.unitId, [["tags"]]);
					await removeTagStructureApplication({
						unitId: params.unitId,
						structureId: params.structureId,
						profileId: profile.unitId,
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:update",
					params: UnitTagStructureParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagStructureApplicationNotFound",
						]),
					},
					detail: { summary: "Remove a Tag structure from a Unit", tags: ["Tags"] },
				},
			)
			.put(
				"/:type/:unitId/tag-structures/:structureId/vote",
				async ({ params, body, profile, authorization }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					return voteTagStructureApplication({
						unitId: params.unitId,
						structureId: params.structureId,
						profileId: profile.unitId,
						value: body.value,
					});
				},
				{
					access: "contribute:interaction:write",
					params: UnitTagStructureParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: TagStructureApplicationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
							"InvalidTagStructure",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagStructureApplicationNotFound",
						]),
					},
					detail: { summary: "Vote on a Unit Tag structure", tags: ["Tags"] },
				},
			)
			.delete(
				"/:type/:unitId/tag-structures/:structureId/vote",
				async ({ params, profile, authorization }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					return deleteTagStructureApplicationVote({
						unitId: params.unitId,
						structureId: params.structureId,
						profileId: profile.unitId,
					});
				},
				{
					access: "write:interaction:write",
					params: UnitTagStructureParams,
					response: {
						[StatusCodes.OK]: TagStructureApplicationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagStructureApplicationNotFound",
						]),
					},
					detail: { summary: "Remove a Unit Tag structure vote", tags: ["Tags"] },
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
