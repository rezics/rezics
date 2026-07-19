import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { decodeCursor, encodeCursor } from "../../pagination";
import {
	createUnit,
	deleteUnit,
	getUnit,
	listUnits,
	updateUnit,
	upsertLocalization,
} from "../../units/service";
import {
	createSlugNamespace,
	releaseSlugRedirect,
	resolveUnitPath,
	updateUnitSlugAddress,
} from "../../units/slug-address";
import {
	CreateUnitBody,
	CreateSlugNamespaceBody,
	ListUnitsQuery,
	ReleaseSlugRedirectBody,
	ResolveUnitPathBody,
	ResolvedUnitPathResponse,
	SlugNamespaceCreatedResponse,
	SlugRedirectParams,
	UpdateUnitBody,
	UpdateUnitAddressBody,
	UpdateUnitAddressParams,
	UnitAddressMutationResponse,
	UnitLocalizationBody,
	UnitLocalizationParams,
	UnitLookupParams,
	UnitUnitIdParams,
	UnitTypeParams,
} from "./schema";
import { NoContentResponse } from "../schema/action-response";
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
	"UnitPermissionForbidden",
	"UnitProtected",
]);
const UnitAuthorizationForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"UnitPermissionForbidden",
	"UnitProtected",
]);
const UnitChangedResponse = toApiErrorResponse(["UnitChanged"]);
const SlugMutationBadRequestResponse = toApiErrorResponse(["InvalidSlug", "UnitAddressUnchanged"]);
const SlugMutationForbiddenResponse = toApiErrorResponse([
	"PlatformCapabilityRequired",
	"UnitAddressMutationForbidden",
]);
const SlugMutationConflictResponse = toApiErrorResponse([
	"SlugTaken",
	"SlugScopeUnavailable",
	"SlugScopeCycle",
	"SlugRedirectLoop",
]);
const SlugMutationNotFoundResponse = toApiErrorResponse([
	"UnitNotFound",
	"SlugScopeNotFound",
	"SlugRedirectNotFound",
]);

export default new Elysia({ prefix: "/units" })
	.use(session)
	.post(
		"/resolve",
		async ({ body }) => {
			const result = await resolveUnitPath(body.path);
			return {
				...result,
				path: [...result.path],
				canonicalPath: [...result.canonicalPath],
			};
		},
		{
			body: ResolveUnitPathBody,
			response: {
				[StatusCodes.OK]: ResolvedUnitPathResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"SlugRedirectNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"SlugScopeCycle",
					"SlugScopeUnavailable",
					"SlugRedirectLoop",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["SlugDepthExceeded"]),
			},
			detail: { summary: "Resolve a canonical Unit slug path", tags: ["Units"] },
		},
	)
	.post(
		"/slug-namespaces",
		async ({ authorization, body }) => {
			const result = await createSlugNamespace(authorization, body);
			return { ...result, canonicalPath: [...result.canonicalPath] };
		},
		{
			access: "session-only",
			body: CreateSlugNamespaceBody,
			response: {
				[StatusCodes.OK]: SlugNamespaceCreatedResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
				[StatusCodes.FORBIDDEN]: SlugMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: SlugMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: SlugMutationConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["SlugDepthExceeded"]),
			},
			detail: { summary: "Create a staff-managed slug namespace", tags: ["Units"] },
		},
	)
	.put(
		"/slug-addresses/:unitId",
		async ({ params, authorization, body }) => {
			const result = await updateUnitSlugAddress(authorization, {
				unitId: params.unitId,
				...body,
			});
			return { ...result, canonicalPath: [...result.canonicalPath] };
		},
		{
			access: "session-only",
			params: UpdateUnitAddressParams,
			body: UpdateUnitAddressBody,
			response: {
				[StatusCodes.OK]: UnitAddressMutationResponse,
				[StatusCodes.BAD_REQUEST]: SlugMutationBadRequestResponse,
				[StatusCodes.FORBIDDEN]: SlugMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: SlugMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: SlugMutationConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["SlugDepthExceeded"]),
			},
			detail: { summary: "Change a Unit slug address as staff", tags: ["Units"] },
		},
	)
	.delete(
		"/slug-redirects/:redirectUnitId",
		async ({ params, authorization, body, status }) => {
			await releaseSlugRedirect(authorization, {
				redirectUnitId: params.redirectUnitId,
				reason: body.reason,
			});
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			access: "session-only",
			params: SlugRedirectParams,
			body: ReleaseSlugRedirectBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: SlugMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["SlugRedirectNotFound"]),
			},
			detail: {
				summary: "Release a slug Redirect as staff",
				tags: ["Units"],
				responses: NoContentResponse,
			},
		},
	)
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
