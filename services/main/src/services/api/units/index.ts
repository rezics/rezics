import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { decodeCursor, encodeCursor } from "../../pagination";
import { listUnitStatusEvents } from "../../units/status";
import {
	createUnit,
	deleteUnitContentLanguage,
	getUnitLocalizationOrder,
	getUnit,
	listUnits,
	updateUnitLocalizationOrder,
	updateUnit,
	upsertLocalization,
} from "../../units/service";
import {
	CreateUnitBody,
	ListUnitsQuery,
	UpdateUnitBody,
	UnitLocalizationBody,
	UnitLocalizationDeleteBody,
	UnitLocalizationDeleteParams,
	UnitLocalizationOrderBody,
	UnitLocalizationOrderParams,
	UnitLocalizationOrderResponse,
	UnitLocalizationParams,
	UnitDetailQuery,
	UnitLookupParams,
	UnitUnitIdParams,
	VariantUnitUnitIdParams,
	WorkUnitTypeParams,
	VariantUnitTypeParams,
	UnitStatusEventListQuery,
	UnitStatusEventListResponse,
	UnitStatusEventParams,
	UpdateUnitVariantContextBody,
	PromoteUnitVariantBody,
	UnitSeriesMembershipListResponse,
	UnitSeriesMembershipQuery,
	ResolveUnitPresentationsBody,
	ListUnitRealmPublicationsQuery,
	UnitRealmPublicationListResponse,
	UnitRealmPublicationParams,
} from "./schema";
import {
	toApiErrorResponse,
	UnitDetailResponse,
	UnitListResponse,
	UnitPresentationListResponse,
} from "../schema/response";
import {
	getUnitSeriesMemberships,
	promoteUnitVariantToMain,
	updateUnitVariantContext,
} from "../../units/variants";
import { getReadableUnitPresentationsByIds } from "../../units/attribution";
import {
	createUnitRealmPublication,
	listUnitRealmPublications,
	republishUnitRealmPublication,
	withdrawUnitRealmPublication,
} from "../../units/realm-publication";
import { NoContentResponse } from "../schema/action-response";

const AuthenticationRequiredResponse = toApiErrorResponse(["AuthenticationRequired"]);
const UnitReadFailureResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationNotFoundResponse = toApiErrorResponse([
	"UnitNotFound",
	"ImageAssetNotFound",
	"EntityEntryNotFound",
]);
const UnitCreateForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"EntityAssociationRestricted",
]);
const UnitCreateBadRequestResponse = toApiErrorResponse(["CreditAttributionRoleInvalid"]);
const UnitCreateConflictResponse = toApiErrorResponse([
	"CreditAttributionRequestConfirmationRequired",
	"UnitVariantKindMismatch",
	"UnitVariantTargetIsVariant",
	"UnitVariantSourceHasVariants",
	"UnitVariantChanged",
	"UnitVariantMainUnavailable",
]);
const UnitLocalizationOrderBadRequestResponse = toApiErrorResponse([
	"UnitLocalizationOrderInvalid",
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
	"UnitContentLicenseGrantForbidden",
]);
const UnitAuthorizationForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"UnitPermissionForbidden",
]);
const UnitChangedResponse = toApiErrorResponse(["UnitChanged"]);
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
const UnitVariantConflictResponse = toApiErrorResponse([
	"UnitVariantKindMismatch",
	"UnitVariantTargetIsVariant",
	"UnitVariantSourceHasVariants",
	"UnitVariantChanged",
	"UnitVariantMainUnavailable",
]);
export default new Elysia({ prefix: "/units" })
	.use(session)
	.post(
		"/presentations",
		async ({ body, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			const presentations = await getReadableUnitPresentationsByIds({
				unitIds: body.ids,
				localizationLanguages: body.localizationLanguages,
				profileId: identity.authorization.profileId,
			});
			return {
				items: body.ids.flatMap((id) => {
					const presentation = presentations.get(id);
					return presentation ? [presentation] : [];
				}),
			};
		},
		{
			body: ResolveUnitPresentationsBody,
			response: { [StatusCodes.OK]: UnitPresentationListResponse },
			detail: { summary: "Resolve readable Unit presentations", tags: ["Units"] },
		},
	)
	.get(
		"/by-id/:unitId/realm-publications",
		async ({ params, query, authorization }) => {
			const limit = query.limit ?? 50;
			const cursor = decodeCursor(query.cursor);
			const rows = await listUnitRealmPublications({
				unitId: params.unitId,
				authorization,
				localizationLanguages: query.localizationLanguages,
				publicationState: query.publicationState ?? "active",
				status: query.realmStatus ?? "current",
				cursor: cursor ? [new Date(cursor[0]), cursor[1]] : undefined,
				limit: limit + 1,
			});
			const hasMore = rows.length > limit;
			const items = hasMore ? rows.slice(0, limit) : rows;
			const last = items.at(-1);
			return {
				items,
				nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last.realmId) : null,
			};
		},
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
	)
	.post(
		"/by-id/:unitId/realm-publications/:realmId",
		async ({ params, authorization }) => {
			await createUnitRealmPublication({
				unitId: params.unitId,
				realmId: params.realmId,
				authorization,
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
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
	)
	.post(
		"/by-id/:unitId/realm-publications/:realmId/withdraw",
		async ({ params, authorization }) => {
			await withdrawUnitRealmPublication({
				unitId: params.unitId,
				realmId: params.realmId,
				authorization,
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
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
	)
	.post(
		"/by-id/:unitId/realm-publications/:realmId/republish",
		async ({ params, authorization }) => {
			await republishUnitRealmPublication({
				unitId: params.unitId,
				realmId: params.realmId,
				authorization,
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
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
	)
	.get(
		"/by-id/:unitId/series-memberships",
		async ({ params, query, request }) => {
			const authorization = (await resolveIdentity(request.headers, "unit:read"))
				.authorization;
			await authorization.unit.ensureCanRead(params.unitId);
			return {
				items: await getUnitSeriesMemberships(
					params.unitId,
					authorization.profileId,
					query.localizationLanguages,
				),
			};
		},
		{
			params: UnitStatusEventParams,
			query: UnitSeriesMembershipQuery,
			response: {
				[StatusCodes.OK]: UnitSeriesMembershipListResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: { summary: "List Unit Series memberships", tags: ["Units", "Series"] },
		},
	)
	.get(
		"/by-id/:unitId/status-events",
		async ({ params, query, request }) => {
			const authorization = (await resolveIdentity(request.headers, "unit:read"))
				.authorization;
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
	)
	.get(
		"/by-id/:unitId/localization-order",
		async ({ params, request }) => ({
			languages: await getUnitLocalizationOrder(
				params.unitId,
				(await resolveIdentity(request.headers, "unit:read")).authorization,
			),
		}),
		{
			params: UnitLocalizationOrderParams,
			response: {
				[StatusCodes.OK]: UnitLocalizationOrderResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: { summary: "Get Unit content language order", tags: ["Units"] },
		},
	)
	.put(
		"/by-id/:unitId/localization-order",
		async ({ params, authorization, body }) => ({
			languages: await updateUnitLocalizationOrder(params.unitId, authorization, body),
		}),
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
	)
	.delete(
		"/by-id/:unitId/localizations/:language",
		async ({ params, authorization, body }) => ({
			languages: await deleteUnitContentLanguage(
				params.unitId,
				params.language,
				authorization,
				body.expectedLanguages,
			),
		}),
		{
			access: "contribute:unit:update",
			params: UnitLocalizationDeleteParams,
			body: UnitLocalizationDeleteBody,
			response: {
				[StatusCodes.OK]: UnitLocalizationOrderResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitLocalizationMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitLocalizationOrderConflictResponse,
			},
			detail: { summary: "Remove a Unit content language", tags: ["Units"] },
		},
	)
	.get(
		"/:type",
		async ({ params, query }) => {
			const limit = query.limit ?? 20;
			const cursor = decodeCursor(query.cursor);
			const rows = await listUnits(params.type, cursor, limit, query.localizationLanguages);
			const hasMore = rows.length > limit;
			const items = hasMore ? rows.slice(0, limit) : rows;
			const last = items.at(-1);
			return {
				items,
				nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
			};
		},
		{
			params: WorkUnitTypeParams,
			query: ListUnitsQuery,
			response: {
				[StatusCodes.OK]: UnitListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
			},
			detail: { summary: "List published units", tags: ["Units"] },
		},
	)
	.post(
		"/:type",
		async ({ params, authorization, body }) => {
			return createUnit(params.type, authorization, body);
		},
		{
			access: "contribute:unit:create",
			params: VariantUnitTypeParams,
			body: CreateUnitBody,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.BAD_REQUEST]: UnitCreateBadRequestResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitCreateForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitCreateConflictResponse,
			},
			detail: { summary: "Create unit", tags: ["Units"] },
		},
	)
	.get(
		"/:type/:unitId",
		async ({ params, query, request }) => {
			return getUnit(
				params.type,
				params.unitId,
				(await resolveIdentity(request.headers, "unit:read")).authorization,
				query.localizationLanguages,
			);
		},
		{
			params: UnitLookupParams,
			query: UnitDetailQuery,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: { summary: "Get unit", tags: ["Units"] },
		},
	)
	.patch(
		"/:type/:unitId",
		async ({ params, authorization, body }) => {
			return updateUnit(params.type, params.unitId, authorization, body);
		},
		{
			access: "contribute:unit:update",
			params: UnitUnitIdParams,
			body: UpdateUnitBody,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitUpdateForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitChangedResponse,
			},
			detail: { summary: "Update unit", tags: ["Units"] },
		},
	)
	.patch(
		"/:type/:unitId/variant-context",
		async ({ params, authorization, body }) => {
			await updateUnitVariantContext({
				kind: params.type,
				variantUnitId: params.unitId,
				mainUnitId: body.mainUnitId,
				expectedMainUnitId: body.expectedMainUnitId,
				actorProfileId: authorization.profileId,
				authorization: authorization.unit,
			});
			return getUnit(params.type, params.unitId, authorization);
		},
		{
			access: "contribute:unit:update",
			params: VariantUnitUnitIdParams,
			body: UpdateUnitVariantContextBody,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
				[StatusCodes.CONFLICT]: UnitVariantConflictResponse,
			},
			detail: { summary: "Update Unit Main relationship", tags: ["Units"] },
		},
	)
	.post(
		"/:type/:unitId/variant-context/promote",
		async ({ params, authorization, body }) => {
			await promoteUnitVariantToMain({
				kind: params.type,
				variantUnitId: params.unitId,
				expectedMainUnitId: body.expectedMainUnitId,
				actorProfileId: authorization.profileId,
				authorization: authorization.unit,
			});
			return getUnit(params.type, params.unitId, authorization);
		},
		{
			access: "contribute:unit:update",
			params: VariantUnitUnitIdParams,
			body: PromoteUnitVariantBody,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
				[StatusCodes.CONFLICT]: UnitVariantConflictResponse,
			},
			detail: { summary: "Promote Unit Variant to Main", tags: ["Units"] },
		},
	)
	.put(
		"/:type/:unitId/localizations/:language",
		async ({ params, authorization, body }) => {
			await upsertLocalization(params.unitId, authorization, {
				...body,
				language: params.language,
			});
			return getUnit(params.type, params.unitId, authorization);
		},
		{
			access: "contribute:unit:update",
			params: UnitLocalizationParams,
			body: UnitLocalizationBody,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitAuthorizationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
			},
			detail: { summary: "Create or replace unit localization", tags: ["Units"] },
		},
	);
