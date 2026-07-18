import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { decodeCursor, encodeCursor } from "../../pagination";
import {
	createUnit,
	deleteUnit,
	getUnit,
	listUnits,
	resolveUnitSlug,
	updateUnit,
	upsertLocalization,
} from "../../units/service";
import {
	CreateUnitBody,
	ListUnitsQuery,
	UpdateUnitBody,
	UnitLocalizationBody,
	UnitLocalizationParams,
	UnitLookupParams,
	UnitSlugResolverParams,
	UnitUnitIdParams,
	UnitTypeParams,
} from "./schema";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse, UnitDetailResponse, UnitListResponse } from "../schema/response";

const AuthenticationRequiredResponse = toApiErrorResponse(["AuthenticationRequired"]);
const UnitReadFailureResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationNotFoundResponse = toApiErrorResponse(["UnitNotFound", "ImageAssetNotFound"]);
const UnitCreateForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
]);
const UnitUpdateBadRequestResponse = toApiErrorResponse(["UnitPrimaryLanguageMissing"]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"UnitEditForbidden",
	"UnitFieldLocked",
]);
const UnitAuthorizationForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"UnitEditForbidden",
	"UnitFieldLocked",
]);
const UnitChangedResponse = toApiErrorResponse(["UnitChanged"]);

export default new Elysia({ prefix: "/units" })
	.use(session)
	.get(
		"/:type",
		async ({ params, query }) => {
			const limit = query.limit ?? 20;
			const cursor = decodeCursor(query.cursor);
			const rows = await listUnits(params.type, cursor, limit);
			const hasMore = rows.length > limit;
			const items = hasMore ? rows.slice(0, limit) : rows;
			const last = items.at(-1);
			return {
				items,
				nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
			};
		},
		{
			params: UnitTypeParams,
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
			params: UnitTypeParams,
			body: CreateUnitBody,
			response: {
				[StatusCodes.OK]: UnitDetailResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitCreateForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
			},
			detail: { summary: "Create unit", tags: ["Units"] },
		},
	)
	.get(
		"/resolve/:scope/:slug",
		async ({ params }) => {
			const result = await resolveUnitSlug(params.scope, params.slug);
			return { id: result.id };
		},
		{
			params: UnitSlugResolverParams,
			response: {
				[StatusCodes.OK]: IdResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: { summary: "Resolve a scoped Unit slug", tags: ["Units"] },
		},
	)
	.get(
		"/:type/:unitId",
		async ({ params, request }) => {
			return getUnit(
				params.type,
				params.unitId,
				(await resolveIdentity(request.headers, "unit:read")).authorization,
			);
		},
		{
			params: UnitLookupParams,
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
				[StatusCodes.BAD_REQUEST]: UnitUpdateBadRequestResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitChangedResponse,
			},
			detail: { summary: "Update unit", tags: ["Units"] },
		},
	)
	.delete(
		"/:type/:unitId",
		async ({ params, authorization, status }) => {
			await deleteUnit(params.type, params.unitId, authorization);
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			access: "write:unit:delete",
			params: UnitUnitIdParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UnitAuthorizationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
			},
			detail: {
				summary: "Delete unit",
				tags: ["Units"],
				responses: NoContentResponse,
			},
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
