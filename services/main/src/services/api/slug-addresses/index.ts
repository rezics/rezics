import { DevelopmentPreviewCapability } from "@rezics/access";
import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import { UnitNotFound } from "../../units/errors";
import {
	getCanonicalUnitSlugAddressWithPlatformAccess,
	getPublicCanonicalUnitSlugAddress,
	releaseSlugRedirect,
	replaceUnitSlugAddressWithPlatformAccess,
	resolveScopedUnitAddress,
	resolveUnitPath,
} from "../../units/slug-address";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	CanonicalSlugAddressResponse,
	ReleaseSlugRedirectBody,
	ReplaceUnitSlugAddressBody,
	ResolvedSlugAddressResponse,
	ResolveSlugAddressBody,
	ResolveScopedSlugAddressQuery,
	ScopedSlugAddressParams,
	NamespaceSlugAddressParams,
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
	"GovernanceRuleChanged",
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
					"Resolves two or three slug labels to a public Unit ID and reports its canonical path. Browser routes use the resolved ID for subsequent resource reads and cache identity.",
				tags: ["Slug Addresses"],
			},
		},
		async ({ body }) => {
			const result = await resolveUnitPath(body.path);
			return { ...presentPath(result), path: [...result.path] };
		},
	)
	.get(
		"/public-units/:unitId",
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
		async ({ params }) => {
			const address = await getPublicCanonicalUnitSlugAddress(params.unitId);
			if (!address) throw new UnitNotFound();
			return address;
		},
	)
	.get(
		"/scopes/:scopeUnitId/:slug",
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
					"Resolves a direct scope Unit ID and slug label to a public Unit ID. An optional expected owner prevents cross-resource matches. The response includes the complete canonical path so callers can redirect former addresses.",
				tags: ["Slug Addresses"],
			},
		},
		async ({ params, query }) => {
			const result = await resolveScopedUnitAddress(
				{ scopeUnitId: params.scopeUnitId, scopeNamespaceId: null },
				params.slug,
				query.owner,
			);
			return { ...presentPath(result), path: [...result.path] };
		},
	)
	.get(
		"/namespaces/:scopeNamespaceId/:slug",
		{
			params: NamespaceSlugAddressParams,
			query: ResolveScopedSlugAddressQuery,
			response: {
				[StatusCodes.OK]: ResolvedSlugAddressResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: {
				operationId: "resolveNamespaceSlugAddress",
				summary: "Resolve a resource in a permanent namespace",
				tags: ["Slug Addresses"],
			},
		},
		async ({ params, query }) => {
			const result = await resolveScopedUnitAddress(
				{ scopeUnitId: null, scopeNamespaceId: params.scopeNamespaceId },
				params.slug,
				query.owner,
			);
			return { ...presentPath(result), path: [...result.path] };
		},
	)

	.get(
		"/units/:unitId",
		{
			access: "session-only",
			params: UnitSlugAddressParams,
			response: {
				[StatusCodes.OK]: CanonicalSlugAddressResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "UnitSlugAddressNotFound"]),
			},
			detail: {
				operationId: "getUnitSlugAddressWithPlatformAccess",
				summary: "Get a Unit canonical slug address with platform access",
				description:
					"Development-preview control plane. Returns canonical address registry details for authorized platform workflows, including the administrative address ID. Ordinary resource responses expose only the nullable public slugAddress projection.",
				tags: ["Slug Addresses"],
			},
		},
		async ({ params, authorization }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			return getCanonicalUnitSlugAddressWithPlatformAccess(authorization, params.unitId);
		},
	)
	.put(
		"/units/:unitId",
		{
			access: "session-only",
			params: UnitSlugAddressParams,
			body: ReplaceUnitSlugAddressBody,
			response: {
				[StatusCodes.OK]: SlugAddressMutationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"InvalidSlug",
					"GovernanceRuleSourceForbidden",
				]),
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
					"Development-preview control plane. Assigns or replaces a canonical address independently of Unit creation and update. It retains the former address as a redirect and succeeds idempotently when the requested address is already canonical.",
				tags: ["Slug Addresses"],
			},
		},
		async ({ params, authorization, body }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			return presentPath(
				await replaceUnitSlugAddressWithPlatformAccess(authorization, {
					unitId: params.unitId,
					...body,
				}),
			);
		},
	)
	.delete(
		"/redirects/:redirectAddressId",
		{
			access: "session-only",
			params: SlugRedirectAddressParams,
			body: ReleaseSlugRedirectBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["GovernanceRuleSourceForbidden"]),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: SlugMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["SlugRedirectNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["GovernanceRuleChanged"]),
			},
			detail: {
				operationId: "releaseSlugRedirectWithPlatformAccess",
				summary: "Release a retained slug redirect with platform access",
				description:
					"Development-preview control plane. Deletes one temporary Redirect record so its scoped label may be reused. This is an audited platform action; retention and quarantine policy determines when a redirect is eligible for release.",
				tags: ["Slug Addresses"],
				responses: NoContentResponse,
			},
		},
		async ({ params, authorization, body, status }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			await releaseSlugRedirect(authorization, {
				redirectAddressId: params.redirectAddressId,
				rules: body.rules,
			});
			return status(StatusCodes.NO_CONTENT, undefined);
		},
	);
