import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

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
	CatalogUnitTypeParams,
	VariantUnitTypeParams,
	UnitStatusEventListQuery,
	UnitStatusEventListResponse,
	UnitStatusEventParams,
	UpdateUnitVariantContextBody,
	PromoteUnitVariantBody,
	UnitSeriesMembershipListResponse,
	UnitSeriesMembershipQuery,
	ResolveUnitPresentationsBody,
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
const UnitAuthorizationForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"UnitPermissionForbidden",
]);
const UnitChangedResponse = toApiErrorResponse(["UnitChanged"]);
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
			params: CatalogUnitTypeParams,
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
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitCreateForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitVariantConflictResponse,
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
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
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
