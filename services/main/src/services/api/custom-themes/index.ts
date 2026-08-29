import {
	CustomThemeExternalLiveAccessCapability,
	CustomThemeKillCapability,
	CustomThemeReviewCapability,
	DevelopmentPreviewCapability,
	type PlatformCapability,
} from "@rezics/access";
import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import { database } from "../../database";
import {
	createCustomTheme,
	decideCustomThemeRevision,
	ensureCustomThemeExists,
	getCustomThemeExecutionControl,
	getCustomThemeReferenceRenderArtifactLocation,
	getExecutableCustomThemeFile,
	killCustomThemeRevision,
	listCustomThemeReviewQueue,
	listCustomThemeRevisions,
	setCustomThemeExecutionControl,
	submitCustomThemeRevision,
} from "../../custom-themes";
import { upsertLocalization } from "../../units/service";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	CreateCustomThemeBody,
	CustomThemeCursorQuery,
	CustomThemeFileQuery,
	CustomThemeExecutionControlResponse,
	CustomThemeLocalizationBody,
	CustomThemeLocalizationParams,
	CustomThemeParams,
	CustomThemeResponse,
	CustomThemeReviewQueueResponse,
	CustomThemeRevisionListResponse,
	CustomThemeRevisionParams,
	CustomThemeRevisionResponse,
	CustomThemeReferenceRenderArtifactParams,
	DecideCustomThemeRevisionBody,
	KillCustomThemeRevisionBody,
	SetCustomThemeExecutionControlBody,
	SubmitCustomThemeRevisionBody,
} from "./schema";

const CapabilityForbiddenResponse = toApiErrorResponse(["PlatformCapabilityRequired"]);
const ThemeNotFoundResponse = toApiErrorResponse(["CustomThemeNotFound"]);
const RevisionNotFoundResponse = toApiErrorResponse(["CustomThemeRevisionNotFound"]);
const RevisionConflictResponse = toApiErrorResponse(["CustomThemeRevisionStateConflict"]);

async function ensureExternalLiveEligibility(authorization: {
	readonly platform: {
		readonly ensureCapability: (capability: PlatformCapability) => Promise<void>;
	};
}) {
	await Promise.all([
		authorization.platform.ensureCapability(DevelopmentPreviewCapability),
		authorization.platform.ensureCapability(CustomThemeExternalLiveAccessCapability),
	]);
}

export default new Elysia({ prefix: "/custom-themes" })
	.use(session)
	.get(
		"/execution-control",
		async ({ authorization }) => {
			await authorization.platform.ensureCapability(CustomThemeKillCapability);
			return getCustomThemeExecutionControl();
		},
		{
			access: "session-only",
			response: {
				[StatusCodes.OK]: CustomThemeExecutionControlResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
			},
			detail: { summary: "Get the Custom Theme execution kill switch", tags: ["Custom Themes"] },
		},
	)
	.put(
		"/execution-control",
		async ({ authorization, profile, body }) => {
			await authorization.platform.ensureCapability(CustomThemeKillCapability);
			return database.transaction((tx) =>
				setCustomThemeExecutionControl(tx, {
					enabled: body.enabled,
					reason: body.reason,
					actorProfileId: profile.unitId,
				}),
			);
		},
		{
			access: "fresh-session-only",
			body: SetCustomThemeExecutionControlBody,
			response: {
				[StatusCodes.OK]: CustomThemeExecutionControlResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"FreshSessionRequired",
				]),
			},
			detail: { summary: "Set the Custom Theme execution kill switch", tags: ["Custom Themes"] },
		},
	)
	.post(
		"/",
		async ({ authorization, profile, body }) => {
			await ensureExternalLiveEligibility(authorization);
			return createCustomTheme({ ownerProfileId: profile.unitId, localization: body.localization });
		},
		{
			access: "contribute:unit:create",
			body: CreateCustomThemeBody,
			response: {
				[StatusCodes.OK]: CustomThemeResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ImageAssetNotFound"]),
			},
			detail: { summary: "Create a Custom Theme Unit", tags: ["Custom Themes"] },
		},
	)
	.put(
		"/:themeUnitId/localizations/:language",
		async ({ authorization, params, body, status }) => {
			await ensureExternalLiveEligibility(authorization);
			await ensureCustomThemeExists(params.themeUnitId);
			const { revisionContext, ...localization } = body;
			await upsertLocalization(params.themeUnitId, authorization, {
				...localization,
				language: params.language,
				revisionContribution: revisionContext?.contribution,
			});
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			access: "contribute:unit:update",
			params: CustomThemeLocalizationParams,
			body: CustomThemeLocalizationBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["CustomThemeNotFound", "ImageAssetNotFound"]),
			},
			detail: {
				summary: "Create or replace a Custom Theme localization",
				tags: ["Custom Themes"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/review-queue",
		async ({ authorization, query }) => {
			await ensureExternalLiveEligibility(authorization);
			await authorization.platform.ensureCapability(CustomThemeReviewCapability);
			return listCustomThemeReviewQueue({
				...(query.cursor ? { cursor: query.cursor } : {}),
				limit: query.limit ?? 25,
			});
		},
		{
			access: "session-only",
			query: CustomThemeCursorQuery,
			response: {
				[StatusCodes.OK]: CustomThemeReviewQueueResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
			},
			detail: { summary: "List the bounded Custom Theme review queue", tags: ["Custom Themes"] },
		},
	)
	.get(
		"/:themeUnitId/revisions",
		async ({ authorization, params, query }) => {
			await ensureExternalLiveEligibility(authorization);
			await authorization.unit.ensureCanRead(params.themeUnitId);
			return listCustomThemeRevisions({
				themeUnitId: params.themeUnitId,
				...(query.cursor ? { cursor: query.cursor } : {}),
				limit: query.limit ?? 25,
			});
		},
		{
			access: "unit:read",
			params: CustomThemeParams,
			query: CustomThemeCursorQuery,
			response: {
				[StatusCodes.OK]: CustomThemeRevisionListResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ThemeNotFoundResponse,
			},
			detail: { summary: "List immutable Custom Theme revisions", tags: ["Custom Themes"] },
		},
	)
	.post(
		"/:themeUnitId/revisions",
		async ({ authorization, params, profile, body }) => {
			await ensureExternalLiveEligibility(authorization);
			await authorization.unit.ensureCanUpdate(params.themeUnitId, [["theme", "revisions"]]);
			return submitCustomThemeRevision({
				themeUnitId: params.themeUnitId,
				profileId: profile.unitId,
				manifest: body.manifest,
				sourceArchive: body.sourceArchive,
				files: body.files,
			});
		},
		{
			access: "contribute:unit:update",
			params: CustomThemeParams,
			body: SubmitCustomThemeRevisionBody,
			response: {
				[StatusCodes.OK]: CustomThemeRevisionResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: ThemeNotFoundResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["CustomThemePackageInvalid"]),
				[StatusCodes.SERVICE_UNAVAILABLE]: toApiErrorResponse([
					"CustomThemeSubmissionBackpressure",
				]),
			},
			detail: { summary: "Submit an immutable Custom Theme revision", tags: ["Custom Themes"] },
		},
	)
	.post(
		"/:themeUnitId/revisions/:revisionId/decision",
		async ({ authorization, params, profile, body }) => {
			await ensureExternalLiveEligibility(authorization);
			await authorization.platform.ensureCapability(CustomThemeReviewCapability);
			return decideCustomThemeRevision({
				...params,
				profileId: profile.unitId,
				decision: body.decision,
				reason: body.reason,
				...(body.decision === "approve"
					? {
							hostUnitId: body.hostUnitId,
							reviewEvidence: {
								owner: body.owner,
								incidentContact: body.incidentContact,
								licenseFindings: body.licenseFindings,
								acknowledgedRisks: body.acknowledgedRisks,
							},
						}
					: {}),
			});
		},
		{
			access: "session-only",
			params: CustomThemeRevisionParams,
			body: DecideCustomThemeRevisionBody,
			response: {
				[StatusCodes.OK]: CustomThemeRevisionResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"CustomThemeReviewerSeparationRequired",
				]),
				[StatusCodes.NOT_FOUND]: RevisionNotFoundResponse,
				[StatusCodes.CONFLICT]: RevisionConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
					"CustomThemeReviewEvidenceInvalid",
					"CustomThemeInstallationInvalid",
				]),
			},
			detail: { summary: "Approve or reject a Custom Theme revision", tags: ["Custom Themes"] },
		},
	)
	.post(
		"/:themeUnitId/revisions/:revisionId/kill",
		async ({ authorization, params, profile, body }) => {
			await authorization.platform.ensureCapability(CustomThemeKillCapability);
			return killCustomThemeRevision({
				...params,
				profileId: profile.unitId,
				reason: body.reason,
			});
		},
		{
			access: "session-only",
			params: CustomThemeRevisionParams,
			body: KillCustomThemeRevisionBody,
			response: {
				[StatusCodes.OK]: CustomThemeRevisionResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RevisionNotFoundResponse,
				[StatusCodes.CONFLICT]: RevisionConflictResponse,
			},
			detail: { summary: "Emergency-disable a Custom Theme revision", tags: ["Custom Themes"] },
		},
	)
	.get(
		"/:themeUnitId/revisions/:revisionId/reference-render-artifacts/:screenshotAssetId",
		async ({ authorization, params }) => {
			await ensureExternalLiveEligibility(authorization);
			await authorization.platform.ensureCapability(CustomThemeReviewCapability);
			return new Response(null, {
				status: StatusCodes.MOVED_TEMPORARILY,
				headers: {
					location: await getCustomThemeReferenceRenderArtifactLocation(params),
					"cache-control": "private, no-store",
				},
			});
		},
		{
			access: "session-only",
			params: CustomThemeReferenceRenderArtifactParams,
			response: {
				[StatusCodes.MOVED_TEMPORARILY]: t.Void(),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RevisionNotFoundResponse,
			},
			detail: {
				summary: "Resolve a private Custom Theme reference-render artifact",
				tags: ["Custom Themes"],
			},
		},
	)
	.get(
		"/:themeUnitId/revisions/:revisionId/file",
		async ({ authorization, params, profile, query }) => {
			await ensureExternalLiveEligibility(authorization);
			await authorization.unit.ensureCanRead(query.hostUnitId);
			const file = await getExecutableCustomThemeFile({
				...params,
				hostUnitId: query.hostUnitId,
				viewerProfileId: profile.unitId,
				path: query.path,
			});
			return new Response(new Uint8Array(file.bytes).buffer, {
				headers: {
					"Cache-Control": "private, no-store",
					"Content-Type": file.contentType,
					"Content-Security-Policy": "default-src 'none'; sandbox",
					"X-Content-Type-Options": "nosniff",
					ETag: `"sha256-${file.sha256}"`,
				},
			});
		},
		{
			access: "session-only",
			params: CustomThemeRevisionParams,
			query: CustomThemeFileQuery,
			response: {
				[StatusCodes.OK]: t.Any(),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["CustomThemeInstallationInvalid"]),
			},
			detail: { summary: "Read an executable packaged Custom Theme file", tags: ["Custom Themes"] },
		},
	);
