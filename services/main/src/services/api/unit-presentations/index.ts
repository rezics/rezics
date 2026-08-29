import { UnitPresentationDocumentV0 } from "@rezics/block";
import {
	CustomThemeExternalLiveAccessCapability,
	DevelopmentPreviewCapability,
	type PlatformCapability,
} from "@rezics/access";
import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import {
	deleteCustomThemeInstallation,
	getUnitPresentation,
	presentationPolicyFromResolved,
	putCustomThemeInstallation,
	putUnitPresentation,
	resolveUnitPresentation,
} from "../../custom-themes";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	CustomThemeInstallationResponse,
	HostUnitParams,
	PresentationPolicyResponse,
	PutCustomThemeInstallationBody,
	PutUnitPresentationBody,
	ResolvedUnitPresentationResponse,
	ResolveUnitPresentationQuery,
	UnitPresentationResponse,
} from "../custom-themes/schema";

async function viewerEligibility(identity: {
	readonly profile?: { readonly unitId: string } | null;
	readonly authorization: {
		readonly platform: {
			readonly hasCapability: (capability: PlatformCapability) => Promise<boolean>;
		};
	};
}) {
	if (!identity.profile) return false;
	const [hasPreview, hasExternalLive] = await Promise.all([
		identity.authorization.platform.hasCapability(DevelopmentPreviewCapability),
		identity.authorization.platform.hasCapability(CustomThemeExternalLiveAccessCapability),
	]);
	return hasPreview && hasExternalLive;
}

async function ensureInstallerEligibility(
	authorization: {
		readonly platform: {
			readonly ensureCapability: (capability: PlatformCapability) => Promise<void>;
		};
		readonly zone: {
			readonly ensureThemeMutation: (zoneId: string, level: "development_preview") => Promise<void>;
		};
	},
	hostUnitId: string,
) {
	await Promise.all([
		authorization.platform.ensureCapability(DevelopmentPreviewCapability),
		authorization.platform.ensureCapability(CustomThemeExternalLiveAccessCapability),
		authorization.zone.ensureThemeMutation(hostUnitId, "development_preview"),
	]);
}

export default new Elysia({ prefix: "/units/by-id" })
	.model({
		UnitPresentationDocumentV0,
		UnitPresentationResponse,
		ResolvedUnitPresentationResponse,
	})
	.use(session)
	.get(
		"/:unitId/presentation",
		async ({ request, params, query }) => {
			const identity = await resolveIdentity(request, "unit:read");
			await identity.authorization.unit.ensureCanRead(params.unitId);
			return resolveUnitPresentation({
				hostUnitId: params.unitId,
				viewerProfileId: identity.profile?.unitId,
				viewerEligible: await viewerEligibility(identity),
				safeMode: query.safeMode ?? false,
			});
		},
		{
			access: "unit:read",
			params: HostUnitParams,
			query: ResolveUnitPresentationQuery,
			response: {
				[StatusCodes.OK]: ResolvedUnitPresentationResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitPresentationHostUnsupported"]),
			},
			detail: {
				summary: "Resolve a Unit presentation for the current viewer",
				tags: ["Unit Presentations"],
			},
		},
	)
	.get(
		"/:unitId/presentation-policy",
		async ({ request, params, query }) => {
			const identity = await resolveIdentity(request, "unit:read");
			await identity.authorization.unit.ensureCanRead(params.unitId);
			return presentationPolicyFromResolved(
				await resolveUnitPresentation({
					hostUnitId: params.unitId,
					viewerProfileId: identity.profile?.unitId,
					viewerEligible: await viewerEligibility(identity),
					safeMode: query.safeMode ?? false,
				}),
			);
		},
		{
			access: "unit:read",
			params: HostUnitParams,
			query: ResolveUnitPresentationQuery,
			response: {
				[StatusCodes.OK]: PresentationPolicyResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitPresentationHostUnsupported"]),
			},
			detail: {
				summary: "Resolve request-boundary presentation policy",
				tags: ["Unit Presentations"],
			},
		},
	)
	.get(
		"/:unitId/presentation-document",
		async ({ authorization, params }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["presentation"]]);
			const response = await getUnitPresentation(database, params.unitId);
			return response satisfies typeof UnitPresentationResponse.static;
		},
		{
			access: "contribute:unit:update",
			params: HostUnitParams,
			response: {
				[StatusCodes.OK]: UnitPresentationResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitPermissionForbidden"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitPresentationHostUnsupported"]),
			},
			detail: { summary: "Get the Unit-owned presentation document", tags: ["Unit Presentations"] },
		},
	)
	.put(
		"/:unitId/presentation",
		async ({ authorization, params, profile, body }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["presentation"]]);
			return database.transaction((tx) =>
				putUnitPresentation(tx, {
					hostUnitId: params.unitId,
					actorProfileId: profile.unitId,
					expectedRevisionId: body.expectedRevisionId,
					document: body.document,
				}),
			);
		},
		{
			access: "contribute:unit:update",
			params: HostUnitParams,
			body: PutUnitPresentationBody,
			response: {
				[StatusCodes.OK]: UnitPresentationResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitPermissionForbidden"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitPresentationHostUnsupported"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitPresentationRevisionConflict"]),
			},
			detail: {
				summary: "Replace the Unit-owned presentation document",
				tags: ["Unit Presentations"],
			},
		},
	)
	.put(
		"/:unitId/custom-theme-installation",
		async ({ authorization, params, profile, body }) => {
			await ensureInstallerEligibility(authorization, params.unitId);
			return database.transaction((tx) =>
				putCustomThemeInstallation(tx, {
					hostUnitId: params.unitId,
					revisionId: body.revisionId,
					actorProfileId: profile.unitId,
				}),
			);
		},
		{
			access: "contribute:unit:update",
			params: HostUnitParams,
			body: PutCustomThemeInstallationBody,
			response: {
				[StatusCodes.OK]: CustomThemeInstallationResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"CustomThemeRevisionNotFound",
					"UnitPresentationHostUnsupported",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["CustomThemeInstallationInvalid"]),
			},
			detail: { summary: "Install one exact Custom Theme revision", tags: ["Unit Presentations"] },
		},
	)
	.delete(
		"/:unitId/custom-theme-installation",
		async ({ authorization, params, profile, status }) => {
			await ensureInstallerEligibility(authorization, params.unitId);
			await database.transaction((tx) =>
				deleteCustomThemeInstallation(tx, {
					hostUnitId: params.unitId,
					actorProfileId: profile.unitId,
				}),
			);
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			access: "contribute:unit:update",
			params: HostUnitParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitPresentationHostUnsupported"]),
			},
			detail: {
				summary: "Remove the installed Custom Theme revision",
				tags: ["Unit Presentations"],
				responses: NoContentResponse,
			},
		},
	);
