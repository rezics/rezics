import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import { UnitNotFound } from "../../units/errors";
import {
	createSlugNamespace,
	getCanonicalUnitSlugAddressWithPlatformAccess,
	getPublicCanonicalUnitSlugAddress,
	releaseSlugRedirect,
	replaceOwnProfileSlugAddress,
	replaceUnitSlugAddressWithPlatformAccess,
	resolveScopedUnitAddress,
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
	ResolveScopedSlugAddressQuery,
	ScopedSlugAddressParams,
	PublicSlugAddressResponse,
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

/** Public resolution and privileged mutation APIs for scoped Unit addresses. */
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
				summary: "Resolve a complete public Unit slug path",
				description:
					"Resolves one to three slug labels to a public Unit ID and reports its canonical path. Browser routes use the resolved ID for subsequent resource reads and cache identity.",
				tags: ["Slug Addresses"],
			},
		},
	)
	.get(
		"/public-units/:unitId",
		async ({ params }) => {
			const address = await getPublicCanonicalUnitSlugAddress(params.unitId);
			if (!address) throw new UnitNotFound();
			return address;
		},
		{
			params: UnitSlugAddressParams,
			response: {
				[StatusCodes.OK]: PublicSlugAddressResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: {
				operationId: "getPublicUnitSlugAddress",
				summary: "Get a Unit public canonical slug address",
				description:
					"Returns a public Unit's optional canonical slug address for ID-route canonicalization. Missing, private, moderated, deleted, or unaddressed Units all return not found.",
				tags: ["Slug Addresses"],
			},
		},
	)
	.get(
		"/scopes/:scopeUnitId/:slug",
		async ({ params, query }) => {
			const result = await resolveScopedUnitAddress(
				params.scopeUnitId,
				params.slug,
				query.kind,
			);
			return { ...presentPath(result), path: [...result.path] };
		},
		{
			params: ScopedSlugAddressParams,
			query: ResolveScopedSlugAddressQuery,
			response: {
				[StatusCodes.OK]: ResolvedSlugAddressResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: {
				operationId: "resolveScopedUnitSlugAddress",
				summary: "Resolve a Unit slug in its direct scope",
				description:
					"Resolves a direct scope Unit ID and slug label to a public Unit ID. An optional expected kind prevents cross-resource matches. The response includes the complete canonical path so callers can redirect former addresses.",
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
			getCanonicalUnitSlugAddressWithPlatformAccess(authorization, params.unitId),
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
				operationId: "getUnitSlugAddressWithPlatformAccess",
				summary: "Get a Unit canonical slug address with platform access",
				description:
					"Returns canonical address registry details for authorized platform workflows, including the administrative address ID. Ordinary resource responses expose only the nullable public slugAddress projection.",
				tags: ["Slug Addresses"],
			},
		},
	)
	.put(
		"/units/:unitId",
		async ({ params, authorization, body }) =>
			presentPath(
				await replaceUnitSlugAddressWithPlatformAccess(authorization, {
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
				operationId: "replaceUnitSlugAddressWithPlatformAccess",
				summary: "Replace any Unit slug address with platform access",
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
				operationId: "createSlugNamespaceWithPlatformAccess",
				summary: "Create an explicitly addressed namespace with platform access",
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
				operationId: "releaseSlugRedirectWithPlatformAccess",
				summary: "Release a retained slug redirect with platform access",
				description:
					"Deletes one temporary Redirect record so its scoped label may be reused. This is an audited platform action; retention and quarantine policy determines when a redirect is eligible for release.",
				tags: ["Slug Addresses"],
				responses: NoContentResponse,
			},
		},
	);
