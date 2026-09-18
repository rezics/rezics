import { readUnitStateById } from "../../units/query";
import { UnitNotFound } from "../../units/errors";
import { database } from "../../database";
import Elysia, { t } from "elysia";
import { StatusCodes } from "http-status-codes";
import type { StaticDecode } from "typebox";

import session, { resolveIdentity } from "../../auth/session";
import { contentRatingPolicyFromAllowlist } from "../../content-rating/policy";
import { MaximumSubjectAssociationsPageSize } from "@rezics/schema/postgres/shared/contract-values";
import { decodeCursor, encodeCursor } from "../../pagination";
import { resolveRecommendationViewer } from "../../recommendations/context";
import { getReadableUnitPresentationsByIds } from "../../units/attribution";
import { listContentLanguageEvidence } from "../../units/content-language-evidence";
import {
	createUnitRealmPublication,
	listUnitRealmPublications,
	republishUnitRealmPublication,
	withdrawUnitRealmPublication,
} from "../../units/realm-publication";
import { getPublicUnitSeoProjection } from "../../units/seo";
import {
	createTimedMediaUnit,
	deleteUnitContentLanguage,
	getUnit,
	getUnitLocalizationOrder,
	listUnits,
	updateUnit,
	updateUnitLocalizationOrder,
	upsertLocalization,
} from "../../units/service";
import { listUnitStatusEvents } from "../../units/status";
import { listUnitSubjectAssociations } from "../../units/subject-associations";
import { ValidationError } from "../errors";
import { NoContentResponse } from "../schema/action-response";
import {
	toApiErrorResponse,
	UnitDetailResponse,
	UnitListResponse,
	UnitPresentationListResponse,
	UnitSubjectAssociationListResponse,
	VoteBackpressureResponse,
} from "../schema/response";
import {
	UnitReferenceResponse,
	ContentLanguageEvidenceQuery,
	ContentLanguageEvidenceResponse,
	ContentLanguageEvidenceUnitParams,
	CreateTimedMediaBody,
	ListUnitRealmPublicationsQuery,
	ListUnitsQuery,
	PublicUnitSeoParams,
	PublicUnitSeoQuery,
	PublicUnitSeoResponse,
	ResolveUnitPresentationsBody,
	UnitDetailQuery,
	UnitLocalizationBody,
	UnitLocalizationDeleteBody,
	UnitLocalizationDeleteParams,
	UnitLocalizationOrderBody,
	UnitLocalizationOrderParams,
	UnitLocalizationOrderResponse,
	UnitLocalizationParams,
	UnitLookupParams,
	UnitRealmPublicationListResponse,
	UnitRealmPublicationParams,
	UnitStatusEventListQuery,
	UnitStatusEventListResponse,
	UnitStatusEventParams,
	UnitSubjectAssociationsQuery,
	UnitUnitIdParams,
	UpdateUnitBody,
	TimedMediaUnitTypeParams,
} from "./schema";

const AuthenticationRequiredResponse = toApiErrorResponse(["AuthenticationRequired"]);
const UnitReadFailureResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationNotFoundResponse = toApiErrorResponse([
	"UnitNotFound",
	"ImageAssetNotFound",
	"EntityEntryNotFound",
]);
const UnitCreateNotFoundResponse = toApiErrorResponse([
	"UnitNotFound",
	"ImageAssetNotFound",
	"EntityEntryNotFound",
	"TagNotFound",
]);
const UnitCreateForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"EntityAssociationRestricted",
	"UnitLicenseGrantForbidden",
]);
const UnitCreateBadRequestResponse = toApiErrorResponse([
	"CreditAttributionRoleInvalid",
	"RevisionCreditEntityInvalid",
	"RevisionContributionActorRequired",
	"UnitLicenseNotApplicable",
]);
const UnitCreateConflictResponse = toApiErrorResponse([
	"CreditAttributionRequestConfirmationRequired",
	"UnitLicenseGrantConflict",
	"UnitLicenseOfferingEndForbidden",
]);
const UnitLocalizationOrderBadRequestResponse = toApiErrorResponse([
	"UnitLocalizationOrderInvalid",
	"RevisionCreditEntityInvalid",
	"RevisionContributionActorRequired",
]);
const UnitLocalizationOrderConflictResponse = toApiErrorResponse([
	"UnitLocalizationOrderChanged",
	"UnitLastLocalizationRemovalForbidden",
]);
const UnitLocalizationMutationNotFoundResponse = toApiErrorResponse([
	"UnitNotFound",
	"UnitLocalizationNotFound",
]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"UnitPermissionForbidden",
]);
const UnitUpdateForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"UnitPermissionForbidden",
	"UnitLicenseGrantForbidden",
]);
const UnitRevisionContributionBadRequestResponse = toApiErrorResponse([
	"RevisionCreditEntityInvalid",
	"RevisionContributionActorRequired",
]);
const UnitUpdateBadRequestResponse = toApiErrorResponse([
	"RevisionCreditEntityInvalid",
	"RevisionContributionActorRequired",
	"UnitLicenseNotApplicable",
]);
const UnitAuthorizationForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"UnitPermissionForbidden",
]);
const UnitUpdateConflictResponse = toApiErrorResponse([
	"UnitChanged",
	"UnitLicenseGrantConflict",
	"UnitLicenseOfferingEndForbidden",
]);
const UnitRealmPublicationForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"UnitAccessRestricted",
	"UnitPermissionForbidden",
	"RealmCapabilityRequired",
]);
const UnitRealmPublicationNotFoundResponse = toApiErrorResponse([
	"UnitNotFound",
	"UnitRealmPublicationNotFound",
]);
const UnitRealmPublicationConflictResponse = toApiErrorResponse([
	"UnitRealmPublicationAlreadyExists",
	"UnitRealmPublicationTransitionInvalid",
	"RealmRulesAcceptanceRequired",
]);
export default new Elysia({ prefix: "/units" })
	.use(session)
	.get(
		"/by-id/:unitId/reference",
		{
			params: UnitStatusEventParams,
			response: {
				[StatusCodes.OK]: UnitReferenceResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: {
				operationId: "getUnitReference",
				summary: "Resolve a readable native owner reference",
				tags: ["Units"],
			},
		},
		async ({ params, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			return database.transaction(async (tx) => {
				const decision = await authorization.unit.decideInTransaction(
					tx,
					params.unitId,
					"unit.read",
				);
				if (!decision.allowed) throw new UnitNotFound();
				const target = await readUnitStateById(tx, params.unitId, { lock: "share" });
				if (!target) throw new UnitNotFound();
				return { ...target.reference, shape: target.shape };
			});
		},
	)
	.get(
		"/by-id/:unitId/seo",
		{
			params: PublicUnitSeoParams,
			query: PublicUnitSeoQuery,
			response: {
				[StatusCodes.OK]: PublicUnitSeoResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: {
				operationId: "getPublicUnitSeoProjection",
				summary: "Get a sanitized public Unit SEO projection",
				description:
					"Returns bounded metadata for one publicly visitable Unit. Adult-rated Units return only a noindex decision and never expose authored titles, summaries, descriptions, or images.",
				tags: ["Units"],
			},
		},
		async ({ params, query }) => {
			const projection: StaticDecode<typeof PublicUnitSeoResponse> =
				await getPublicUnitSeoProjection(params.unitId, query.localizationLanguages);
			return projection;
		},
	)
	.post(
		"/presentations",
		{
			body: ResolveUnitPresentationsBody,
			response: { [StatusCodes.OK]: UnitPresentationListResponse },
			detail: { summary: "Resolve readable Unit presentations", tags: ["Units"] },
		},
		async ({ body, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			const presentations = await getReadableUnitPresentationsByIds({
				unitIds: body.ids,
				localizationLanguages: body.localizationLanguages ?? [],
				authorization: identity.authorization,
			});
			return {
				items: body.ids.flatMap((id) => {
					const presentation = presentations.get(id);
					return presentation ? [presentation] : [];
				}),
			};
		},
	)
	.get(
		"/by-id/:unitId/realm-publications",
		{
			access: "contribute:unit:update",
			params: UnitStatusEventParams,
			query: ListUnitRealmPublicationsQuery,
			response: {
				[StatusCodes.OK]: UnitRealmPublicationListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.FORBIDDEN]: UnitRealmPublicationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: {
				summary: "List a Unit's Realm publications",
				tags: ["Units", "Realms"],
			},
		},
		async ({ params, query, authorization }) => {
			const limit = query.limit ?? 50;
			const cursor = decodeCursor(query.cursor);
			const page = await listUnitRealmPublications({
				unitId: params.unitId,
				authorization,
				localizationLanguages: query.localizationLanguages ?? [],
				publicationState: query.publicationState ?? "active",
				status: query.realmStatus ?? "current",
				cursor: cursor ? [new Date(cursor[0]), cursor[1]] : undefined,
				limit,
			});
			return {
				items: page.items,
				nextCursor: page.nextCursor ? encodeCursor(page.nextCursor[0], page.nextCursor[1]) : null,
			};
		},
	)
	.post(
		"/by-id/:unitId/realm-publications/:realmId",
		{
			access: "contribute:unit:update",
			params: UnitRealmPublicationParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: UnitRealmPublicationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: UnitRealmPublicationConflictResponse,
			},
			detail: {
				summary: "Publish a Unit to one Realm",
				tags: ["Units", "Realms"],
				responses: NoContentResponse,
			},
		},
		async ({ params, authorization }) => {
			await createUnitRealmPublication({
				unitId: params.unitId,
				realmId: params.realmId,
				authorization,
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	)
	.post(
		"/by-id/:unitId/realm-publications/:realmId/withdraw",
		{
			access: "contribute:unit:update",
			params: UnitRealmPublicationParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: UnitRealmPublicationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitRealmPublicationNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitRealmPublicationConflictResponse,
			},
			detail: {
				summary: "Withdraw a Unit from one Realm",
				tags: ["Units", "Realms"],
				responses: NoContentResponse,
			},
		},
		async ({ params, authorization }) => {
			await withdrawUnitRealmPublication({
				unitId: params.unitId,
				realmId: params.realmId,
				authorization,
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	)
	.post(
		"/by-id/:unitId/realm-publications/:realmId/republish",
		{
			access: "contribute:unit:update",
			params: UnitRealmPublicationParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: UnitRealmPublicationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitRealmPublicationNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitRealmPublicationConflictResponse,
			},
			detail: {
				summary: "Republish a Unit to one Realm",
				tags: ["Units", "Realms"],
				responses: NoContentResponse,
			},
		},
		async ({ params, authorization }) => {
			await republishUnitRealmPublication({
				unitId: params.unitId,
				realmId: params.realmId,
				authorization,
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	)
	.get(
		"/by-id/:unitId/status-events",
		{
			params: UnitStatusEventParams,
			query: UnitStatusEventListQuery,
			response: {
				[StatusCodes.OK]: UnitStatusEventListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: { summary: "List Unit status events", tags: ["Units"] },
		},
		async ({ params, query, request }) => {
			const authorization = (await resolveIdentity(request, "unit:read")).authorization;
			await authorization.unit.ensureCanRead(params.unitId);
			const limit = query.limit ?? 50;
			const rows = await listUnitStatusEvents({
				unitId: params.unitId,
				cursor: decodeCursor(query.cursor),
				limit: limit + 1,
			});
			const hasMore = rows.length > limit;
			const items = hasMore ? rows.slice(0, limit) : rows;
			const last = items.at(-1);
			return {
				items,
				nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
			};
		},
	)
	.get(
		"/by-id/:unitId/localization-order",
		{
			params: UnitLocalizationOrderParams,
			response: {
				[StatusCodes.OK]: UnitLocalizationOrderResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: { summary: "Get Unit content language order", tags: ["Units"] },
		},
		async ({ params, request }) => ({
			languages: await getUnitLocalizationOrder(
				params.unitId,
				(await resolveIdentity(request, "unit:read")).authorization,
			),
		}),
	)
	.put(
		"/by-id/:unitId/localization-order",
		{
			access: "contribute:unit:update",
			params: UnitLocalizationOrderParams,
			body: UnitLocalizationOrderBody,
			response: {
				[StatusCodes.OK]: UnitLocalizationOrderResponse,
				[StatusCodes.BAD_REQUEST]: UnitLocalizationOrderBadRequestResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.CONFLICT]: UnitLocalizationOrderConflictResponse,
			},
			detail: { summary: "Reorder Unit content languages", tags: ["Units"] },
		},
		async ({ params, authorization, body }) => {
			const { revisionContext, ...order } = body;
			return {
				languages: await updateUnitLocalizationOrder(params.unitId, authorization, {
					...order,
					revisionContribution: revisionContext?.contribution,
				}),
			};
		},
	)
	.delete(
		"/by-id/:unitId/localizations/:language",
		{
			access: "contribute:unit:update",
			params: UnitLocalizationDeleteParams,
			body: UnitLocalizationDeleteBody,
			response: {
				[StatusCodes.OK]: UnitLocalizationOrderResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.BAD_REQUEST]: UnitLocalizationOrderBadRequestResponse,
				[StatusCodes.NOT_FOUND]: UnitLocalizationMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitLocalizationOrderConflictResponse,
			},
			detail: { summary: "Remove a Unit content language", tags: ["Units"] },
		},
		async ({ params, authorization, body }) => ({
			languages: await deleteUnitContentLanguage(
				params.unitId,
				params.language,
				authorization,
				body.expectedLanguages,
				body.revisionContext?.contribution,
			),
		}),
	)
	.get(
		"/:type",
		{
			params: TimedMediaUnitTypeParams,
			query: ListUnitsQuery,
			response: {
				[StatusCodes.OK]: UnitListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
			},
			detail: { summary: "List published units", tags: ["Units"] },
		},
		async ({ params, query, request }) => {
			const limit = query.limit ?? 20;
			const cursor = decodeCursor(query.cursor);
			const identity = await resolveIdentity(request, "unit:read");
			const viewer = await resolveRecommendationViewer(identity.authorization.profileId, false);
			const rows = await listUnits(
				params.type,
				cursor,
				limit,
				query.localizationLanguages,
				contentRatingPolicyFromAllowlist(viewer.contentRatings),
			);
			const hasMore = rows.length > limit;
			const items = hasMore ? rows.slice(0, limit) : rows;
			const last = items.at(-1);
			return {
				items,
				nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
			};
		},
	)
	.post(
		"/:type",
		{
			access: "contribute:unit:create",
			params: TimedMediaUnitTypeParams,
			body: CreateTimedMediaBody,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.BAD_REQUEST]: UnitCreateBadRequestResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
					"ValidationError",
					"UnitContentLanguageSupportInvalid",
				]),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitCreateForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitCreateNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitCreateConflictResponse,
				[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
			},
			detail: { summary: "Create unit", tags: ["Units"] },
		},
		async ({ params, authorization, body }) => {
			if (params.type !== body.owner)
				throw new ValidationError({ details: "must match the requested owner" });
			const { revisionContext, ...createBody } = body;
			return createTimedMediaUnit(authorization, {
				...createBody,
				revisionContribution: revisionContext?.contribution,
			});
		},
	)
	.get(
		"/:type/:unitId/content-language-support/evidence",
		{
			access: "contribute:unit:update",
			params: ContentLanguageEvidenceUnitParams,
			query: ContentLanguageEvidenceQuery,
			response: {
				[StatusCodes.OK]: ContentLanguageEvidenceResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: {
				summary: "List bounded Unit content language evidence",
				tags: ["Units"],
			},
		},
		async ({ params, query, authorization }) =>
			listContentLanguageEvidence({
				unitId: params.unitId,
				unitKind: params.type,
				authorization,
				localizationLanguages: query.localizationLanguages ?? [],
				cursor: query.cursor,
				limit: query.limit ?? 20,
			}),
	)
	.get(
		"/:type/:unitId",
		{
			params: UnitLookupParams,
			query: UnitDetailQuery,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: { summary: "Get unit", tags: ["Units"] },
		},
		async ({ params, query, request }) => {
			return getUnit(
				params.type,
				params.unitId,
				(await resolveIdentity(request, "unit:read")).authorization,
				query.localizationLanguages,
			);
		},
	)
	.patch(
		"/:type/:unitId",
		{
			access: "contribute:unit:update",
			params: UnitUnitIdParams,
			body: UpdateUnitBody,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitUpdateForbiddenResponse,
				[StatusCodes.BAD_REQUEST]: UnitUpdateBadRequestResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
					"ValidationError",
					"UnitContentLanguageSupportInvalid",
					"VideoAudioTrackInvalid",
				]),
				[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitUpdateConflictResponse,
			},
			detail: { summary: "Update unit", tags: ["Units"] },
		},
		async ({ params, authorization, body }) => {
			const { updatedAt, revisionContext, ...update } = body;
			return updateUnit(params.type, params.unitId, authorization, {
				...update,
				revisionContribution: revisionContext?.contribution,
				expectedUpdatedAt: new Date(updatedAt),
			});
		},
	)
	.put(
		"/:type/:unitId/localizations/:language",
		{
			access: "contribute:unit:update",
			params: UnitLocalizationParams,
			body: UnitLocalizationBody,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitAuthorizationForbiddenResponse,
				[StatusCodes.BAD_REQUEST]: UnitRevisionContributionBadRequestResponse,
				[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
			},
			detail: { summary: "Create or replace unit localization", tags: ["Units"] },
		},
		async ({ params, authorization, body }) => {
			const { revisionContext, ...localization } = body;
			await upsertLocalization(params.unitId, authorization, {
				...localization,
				revisionContribution: revisionContext?.contribution,
				language: params.language,
			});
			return getUnit(params.type, params.unitId, authorization);
		},
	)
	.get(
		"/by-id/:unitId/subject-associations",
		{
			params: UnitStatusEventParams,
			query: UnitSubjectAssociationsQuery,
			response: {
				[StatusCodes.OK]: UnitSubjectAssociationListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: { summary: "List bounded Unit subject association cards", tags: ["Units"] },
		},
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			return listUnitSubjectAssociations({
				unitId: params.unitId,
				authorization,
				localizationLanguages: query.localizationLanguages ?? [],
				cursor: query.cursor,
				limit: query.limit ?? MaximumSubjectAssociationsPageSize,
			});
		},
	);
