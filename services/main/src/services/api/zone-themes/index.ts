import {
	DevelopmentPreviewCapability,
	ZoneThemeKillCapability,
	ZoneThemeReviewCapability,
} from "@rezics/access";
import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import {
	completeZoneThemeAutomatedReview,
	createZoneTheme,
	decideZoneThemeRevision,
	ensureZoneThemeExists,
	killZoneThemeRevision,
	listZoneThemeReviewQueue,
	listZoneThemeRevisions,
	scheduleZoneThemeContractRevalidation,
	submitZoneThemeRevision,
} from "../../zone-themes/service";
import { upsertLocalization } from "../../units/service";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	CompleteZoneThemeAutomatedReviewBody,
	CreateZoneThemeBody,
	DecideZoneThemeRevisionBody,
	KillZoneThemeRevisionBody,
	ScheduleZoneThemeRevalidationBody,
	ScheduleZoneThemeRevalidationResponse,
	SubmitZoneThemeRevisionBody,
	ZoneThemeLocalizationBody,
	ZoneThemeLocalizationParams,
	ZoneThemeParams,
	ZoneThemeResponse,
	ZoneThemeReviewQueueQuery,
	ZoneThemeReviewQueueResponse,
	ZoneThemeRevisionListResponse,
	ZoneThemeRevisionParams,
	ZoneThemeRevisionResponse,
} from "./schema";

const ThemeNotFoundResponse = toApiErrorResponse(["ZoneThemeNotFound"]);
const RevisionNotFoundResponse = toApiErrorResponse(["ZoneThemeRevisionNotFound"]);
const PreviewForbiddenResponse = toApiErrorResponse(["PlatformCapabilityRequired"]);
const RevisionConflictResponse = toApiErrorResponse(["ZoneThemeRevisionStateConflict"]);

export default new Elysia({ prefix: "/zone-themes" })
	.use(session)
	.post(
		"/",
		async ({ authorization, profile, body }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			return createZoneTheme({ ownerProfileId: profile.unitId, localization: body.localization });
		},
		{
			access: "contribute:unit:create",
			body: CreateZoneThemeBody,
			response: {
				[StatusCodes.OK]: ZoneThemeResponse,
				[StatusCodes.FORBIDDEN]: PreviewForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ImageAssetNotFound"]),
			},
			detail: { summary: "Create a custom Zone theme Unit", tags: ["Zone Themes"] },
		},
	)
	.put(
		"/:themeUnitId/localizations/:language",
		async ({ authorization, params, body, status }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			await ensureZoneThemeExists(params.themeUnitId);
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
			params: ZoneThemeLocalizationParams,
			body: ZoneThemeLocalizationBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ZoneThemeNotFound", "ImageAssetNotFound"]),
			},
			detail: {
				summary: "Create or replace a Zone theme localization",
				tags: ["Zone Themes"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/review-queue",
		async ({ authorization, query }) => {
			await authorization.platform.ensureCapability(ZoneThemeReviewCapability);
			return listZoneThemeReviewQueue({
				...(query.cursor ? { cursor: query.cursor } : {}),
				limit: query.limit ?? 25,
			});
		},
		{
			access: "unit:read",
			query: ZoneThemeReviewQueueQuery,
			response: {
				[StatusCodes.OK]: ZoneThemeReviewQueueResponse,
				[StatusCodes.FORBIDDEN]: PreviewForbiddenResponse,
			},
			detail: { summary: "List the bounded Zone theme review queue", tags: ["Zone Themes"] },
		},
	)
	.post(
		"/revalidation",
		async ({ authorization, body }) => {
			await authorization.platform.ensureCapability(ZoneThemeReviewCapability);
			return scheduleZoneThemeContractRevalidation({
				sourceContractVersion: body.sourceContractVersion,
				...(body.cursor ? { cursor: body.cursor } : {}),
				limit: body.limit ?? 250,
			});
		},
		{
			access: "contribute:unit:update",
			body: ScheduleZoneThemeRevalidationBody,
			response: {
				[StatusCodes.OK]: ScheduleZoneThemeRevalidationResponse,
				[StatusCodes.FORBIDDEN]: PreviewForbiddenResponse,
			},
			detail: {
				summary: "Schedule a keyset batch for Zone theme contract revalidation",
				tags: ["Zone Themes"],
			},
		},
	)
	.get(
		"/:themeUnitId/revisions",
		async ({ authorization, params, query }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			await authorization.unit.ensureCanRead(params.themeUnitId);
			return listZoneThemeRevisions({
				themeUnitId: params.themeUnitId,
				...(query.cursor ? { cursor: query.cursor } : {}),
				limit: query.limit ?? 25,
			});
		},
		{
			access: "unit:read",
			params: ZoneThemeParams,
			query: ZoneThemeReviewQueueQuery,
			response: {
				[StatusCodes.OK]: ZoneThemeRevisionListResponse,
				[StatusCodes.FORBIDDEN]: PreviewForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ThemeNotFoundResponse,
			},
			detail: { summary: "List immutable Zone theme revisions", tags: ["Zone Themes"] },
		},
	)
	.post(
		"/:themeUnitId/revisions",
		async ({ authorization, params, profile, body }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			await authorization.unit.ensureCanUpdate(params.themeUnitId, [["theme", "revisions"]]);
			return submitZoneThemeRevision({
				themeUnitId: params.themeUnitId,
				profileId: profile.unitId,
				css: body.css,
				assetIds: body.assetIds ?? [],
			});
		},
		{
			access: "contribute:unit:update",
			params: ZoneThemeParams,
			body: SubmitZoneThemeRevisionBody,
			response: {
				[StatusCodes.OK]: ZoneThemeRevisionResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: ThemeNotFoundResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
					"ZoneThemeStylesheetInvalid",
					"ZoneThemeAssetsInvalid",
				]),
			},
			detail: { summary: "Submit an immutable Zone theme revision", tags: ["Zone Themes"] },
		},
	)
	.post(
		"/:themeUnitId/revisions/:revisionId/automated-review",
		async ({ authorization, params, body }) => {
			await authorization.platform.ensureCapability(ZoneThemeReviewCapability);
			return completeZoneThemeAutomatedReview({ ...params, ...body });
		},
		{
			access: "contribute:unit:update",
			params: ZoneThemeRevisionParams,
			body: CompleteZoneThemeAutomatedReviewBody,
			response: {
				[StatusCodes.OK]: ZoneThemeRevisionResponse,
				[StatusCodes.FORBIDDEN]: PreviewForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RevisionNotFoundResponse,
				[StatusCodes.CONFLICT]: RevisionConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ZoneThemeAutomatedReviewInvalid"]),
			},
			detail: { summary: "Record Zone theme render-farm and AI review", tags: ["Zone Themes"] },
		},
	)
	.post(
		"/:themeUnitId/revisions/:revisionId/decision",
		async ({ authorization, params, profile, body }) => {
			await authorization.platform.ensureCapability(ZoneThemeReviewCapability);
			return decideZoneThemeRevision({
				...params,
				profileId: profile.unitId,
				decision: body.decision,
				...(body.reason ? { reason: body.reason } : {}),
			});
		},
		{
			access: "contribute:unit:update",
			params: ZoneThemeRevisionParams,
			body: DecideZoneThemeRevisionBody,
			response: {
				[StatusCodes.OK]: ZoneThemeRevisionResponse,
				[StatusCodes.FORBIDDEN]: PreviewForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RevisionNotFoundResponse,
				[StatusCodes.CONFLICT]: RevisionConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ZoneThemeAssetsInvalid"]),
			},
			detail: { summary: "Approve or reject a Zone theme revision", tags: ["Zone Themes"] },
		},
	)
	.post(
		"/:themeUnitId/revisions/:revisionId/kill",
		async ({ authorization, params, profile, body }) => {
			await authorization.platform.ensureCapability(ZoneThemeKillCapability);
			return killZoneThemeRevision({ ...params, profileId: profile.unitId, reason: body.reason });
		},
		{
			access: "contribute:unit:update",
			params: ZoneThemeRevisionParams,
			body: KillZoneThemeRevisionBody,
			response: {
				[StatusCodes.OK]: ZoneThemeRevisionResponse,
				[StatusCodes.FORBIDDEN]: PreviewForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RevisionNotFoundResponse,
				[StatusCodes.CONFLICT]: RevisionConflictResponse,
			},
			detail: { summary: "Kill an approved Zone theme revision globally", tags: ["Zone Themes"] },
		},
	);
