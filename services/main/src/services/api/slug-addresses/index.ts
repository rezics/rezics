import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import {
	createSlugNamespace,
	getCanonicalUnitSlugAddressAsStaff,
	releaseSlugRedirect,
	replaceOwnProfileSlugAddress,
	replaceUnitSlugAddressAsStaff,
	resolveUnitPath,
} from "../../units/slug-address";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	CanonicalSlugAddressResponse,
	CreateSlugNamespaceBody,
	ReleaseSlugRedirectBody,
	ReplaceOwnProfileSlugAddressBody,
	ReplaceUnitSlugAddressBody,
	ResolvedSlugAddressResponse,
	ResolveSlugAddressBody,
	SlugAddressMutationResponse,
	SlugRedirectAddressParams,
	UnitSlugAddressParams,
} from "./schema";

const AuthenticationRequiredResponse = toApiErrorResponse(["AuthenticationRequired"]);
const SlugMutationForbiddenResponse = toApiErrorResponse([
	"PlatformCapabilityRequired",
	"UnitAddressMutationForbidden",
]);
const SlugMutationConflictResponse = toApiErrorResponse([
	"SlugTaken",
	"SlugScopeUnavailable",
	"SlugScopeCycle",
]);
const SlugMutationNotFoundResponse = toApiErrorResponse(["UnitNotFound", "SlugScopeNotFound"]);

function presentPath<T extends { readonly canonicalPath: readonly string[] }>(result: T) {
	return { ...result, canonicalPath: [...result.canonicalPath] };
}

/**
 * Backend-only slug address API.
 *
 * @remarks
 * Core Unit resources remain ID-addressed. The frontend must not call this API
 * until routing, abuse controls, caching, and canonical redirect behavior have
 * been designed and implemented as a separate project.
 */
export default new Elysia({ prefix: "/slug-addresses" })
	.use(session)
	.post(
		"/resolve",
		async ({ body }) => {
			const result = await resolveUnitPath(body.path);
			return { ...presentPath(result), path: [...result.path] };
		},
		{
			body: ResolveSlugAddressBody,
			response: {
				[StatusCodes.OK]: ResolvedSlugAddressResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["SlugScopeCycle"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["SlugDepthExceeded"]),
			},
			detail: {
				operationId: "resolveUnitSlugAddress",
				summary: "Resolve a backend Unit slug address",
				description:
					"Resolves one to three slug labels to a public Unit ID and reports its canonical path. This isolated backend lookup does not alter the ID-based Unit API or enable frontend slug routing.",
				tags: ["Slug Addresses"],
			},
		},
	)
	.put(
		"/profile",
		async ({ authorization, body }) =>
			presentPath(await replaceOwnProfileSlugAddress(authorization, body)),
		{
			access: "write:unit:update",
			body: ReplaceOwnProfileSlugAddressBody,
			response: {
				[StatusCodes.OK]: SlugAddressMutationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"ApiTokenPermissionRequired",
					"EmailVerificationRequired",
					"AccountRestricted",
					"UnitAddressMutationForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: SlugMutationConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["SlugDepthExceeded"]),
			},
			detail: {
				operationId: "replaceOwnProfileSlugAddress",
				summary: "Replace the current Profile slug address",
				description:
					"Sets or replaces the authenticated Profile's optional slug label. The server always uses the permanent users namespace; callers cannot choose a scope. Repeating the same replacement is idempotent.",
				tags: ["Slug Addresses"],
			},
		},
	)
	.get(
		"/units/:unitId",
		async ({ params, authorization }) =>
			getCanonicalUnitSlugAddressAsStaff(authorization, params.unitId),
		{
			access: "session-only",
			params: UnitSlugAddressParams,
			response: {
				[StatusCodes.OK]: CanonicalSlugAddressResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"UnitSlugAddressNotFound",
				]),
			},
			detail: {
				operationId: "getUnitSlugAddressAsStaff",
				summary: "Get a Unit canonical slug address as staff",
				description:
					"Returns the optional canonical slug address stored independently from the Unit. This administrative read is intentionally absent from core Unit responses.",
				tags: ["Slug Addresses"],
			},
		},
	)
	.put(
		"/units/:unitId",
		async ({ params, authorization, body }) =>
			presentPath(
				await replaceUnitSlugAddressAsStaff(authorization, {
					unitId: params.unitId,
					...body,
				}),
			),
		{
			access: "session-only",
			params: UnitSlugAddressParams,
			body: ReplaceUnitSlugAddressBody,
			response: {
				[StatusCodes.OK]: SlugAddressMutationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: SlugMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: SlugMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: SlugMutationConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["SlugDepthExceeded"]),
			},
			detail: {
				operationId: "replaceUnitSlugAddressAsStaff",
				summary: "Replace any Unit slug address as staff",
				description:
					"Assigns or replaces a canonical address independently of Unit creation and update. It retains the former address as a redirect and succeeds idempotently when the requested address is already canonical.",
				tags: ["Slug Addresses"],
			},
		},
	)
	.post(
		"/namespaces",
		async ({ authorization, body, status }) =>
			status(
				StatusCodes.CREATED,
				presentPath(await createSlugNamespace(authorization, body)),
			),
		{
			access: "session-only",
			body: CreateSlugNamespaceBody,
			response: {
				[StatusCodes.CREATED]: SlugAddressMutationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: SlugMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: SlugMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: SlugMutationConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["SlugDepthExceeded"]),
			},
			detail: {
				operationId: "createSlugNamespaceAsStaff",
				summary: "Create an explicitly addressed namespace as staff",
				description:
					"Creates a namespace Unit and its canonical address atomically. A null scope creates a top-level namespace under the virtual root; a Unit ID creates a nested namespace.",
				tags: ["Slug Addresses"],
			},
		},
	)
	.delete(
		"/redirects/:redirectAddressId",
		async ({ params, authorization, body, status }) => {
			await releaseSlugRedirect(authorization, {
				redirectAddressId: params.redirectAddressId,
				reasonCode: body.reasonCode,
			});
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			access: "session-only",
			params: SlugRedirectAddressParams,
			body: ReleaseSlugRedirectBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: SlugMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["SlugRedirectNotFound"]),
			},
			detail: {
				operationId: "releaseSlugRedirectAsStaff",
				summary: "Release a retained slug redirect as staff",
				description:
					"Deletes one redirect address so the scope and label may be reused. This is explicit because retained redirects protect existing backend links.",
				tags: ["Slug Addresses"],
				responses: NoContentResponse,
			},
		},
	);
