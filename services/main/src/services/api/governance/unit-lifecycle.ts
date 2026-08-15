import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

import session from "../../auth/session";
import {
	listPlatformUnits,
	restorePlatformUnit,
	softDeletePlatformUnit,
} from "../../units/platform-lifecycle";
import {
	listPlatformOwnershipCandidates,
	overridePlatformUnitOwnership,
} from "../../units/platform-ownership";
import { toApiErrorResponse } from "../schema/response";
import {
	UnitLifecycleConfirmationInvalid,
	UnitOwnershipOverrideConfirmationInvalid,
} from "./errors";
import {
	ListPlatformUnitsQuery,
	ListUnitOwnershipCandidatesQuery,
	OverrideUnitOwnershipBody,
	PlatformUnitLifecycleResponse,
	PlatformUnitListResponse,
	UnitGovernanceParams,
	DeleteUnitLifecycleCommandBody,
	RestoreUnitLifecycleCommandBody,
	UnitOwnershipCandidateListResponse,
	UnitOwnershipResponse,
} from "./schema";

export default new Elysia({ prefix: "/platform/units" })
	.use(session)
	.get(
		"",
		async ({ authorization, query }) => {
			await authorization.platform.ensureCapability("unit.governance.read");
			return listPlatformUnits({
				state: query.state ?? "active",
				query: query.query,
				cursor: query.cursor,
				limit: query.limit ?? 50,
			});
		},
		{
			access: "session-only",
			query: ListPlatformUnitsQuery,
			response: {
				[StatusCodes.OK]: PlatformUnitListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
			},
			detail: {
				summary: "List Units for platform lifecycle administration",
				tags: ["Governance"],
			},
		},
	)
	.get(
		"/:unitId/ownership-candidates",
		async ({ authorization, params, query }) => {
			await authorization.platform.ensureCapability("unit.ownership.override");
			return listPlatformOwnershipCandidates({
				unitId: params.unitId,
				query: query.query,
				cursor: query.cursor,
				limit: query.limit ?? 50,
			});
		},
		{
			access: "session-only",
			params: UnitGovernanceParams,
			query: ListUnitOwnershipCandidatesQuery,
			response: {
				[StatusCodes.OK]: UnitOwnershipCandidateListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: {
				summary: "Search platform Unit ownership override recipients",
				tags: ["Governance"],
			},
		},
	)
	.post(
		"/:unitId/ownership-override",
		async ({ authorization, profile, params, body }) => {
			if (body.confirmationUnitId !== params.unitId)
				throw new UnitOwnershipOverrideConfirmationInvalid();
			return overridePlatformUnitOwnership(authorization.platform, {
				unitId: params.unitId,
				actorProfileId: profile.unitId,
				expectedOwnerProfileId: body.expectedOwnerProfileId,
				targetProfileId: body.targetProfileId,
				rules: body.rules,
				note: body.note?.trim() || undefined,
			});
		},
		{
			access: "fresh-session-only",
			params: UnitGovernanceParams,
			body: OverrideUnitOwnershipBody,
			response: {
				[StatusCodes.OK]: UnitOwnershipResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"UnitOwnershipOverrideConfirmationInvalid",
					"GovernanceRuleSourceForbidden",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"FreshSessionRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitOwnershipChanged",
					"UnitOwnershipTargetIneligible",
					"GovernanceRuleChanged",
				]),
			},
			detail: {
				summary: "Override Unit ownership through platform governance",
				tags: ["Governance"],
			},
		},
	)
	.post(
		"/:unitId/delete",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability("unit.delete");
			if (body.confirmationUnitId !== params.unitId) throw new UnitLifecycleConfirmationInvalid();
			return softDeletePlatformUnit({
				unitId: params.unitId,
				actorProfileId: profile.unitId,
				expectedUpdatedAt: new Date(body.expectedUpdatedAt),
				rules: body.rules,
				note: body.note?.trim() || undefined,
				contribution: body.revisionContext?.contribution,
			});
		},
		{
			access: "fresh-session-only",
			params: UnitGovernanceParams,
			body: DeleteUnitLifecycleCommandBody,
			response: {
				[StatusCodes.OK]: PlatformUnitLifecycleResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"UnitLifecycleConfirmationInvalid",
					"GovernanceRuleSourceForbidden",
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"FreshSessionRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitLifecycleChanged",
					"UnitLifecycleProtected",
					"UnitAlreadyDeleted",
					"UnitNotDeleted",
					"UnitMergeRequestConflict",
					"GovernanceRuleChanged",
				]),
			},
			detail: {
				summary: "Soft-delete a Unit from the platform Console",
				tags: ["Governance"],
			},
		},
	)
	.post(
		"/:unitId/restore",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability("unit.restore");
			if (body.confirmationUnitId !== params.unitId) throw new UnitLifecycleConfirmationInvalid();
			return restorePlatformUnit({
				unitId: params.unitId,
				actorProfileId: profile.unitId,
				expectedUpdatedAt: new Date(body.expectedUpdatedAt),
				note: body.note?.trim() || undefined,
				contribution: body.revisionContext?.contribution,
			});
		},
		{
			access: "fresh-session-only",
			params: UnitGovernanceParams,
			body: RestoreUnitLifecycleCommandBody,
			response: {
				[StatusCodes.OK]: PlatformUnitLifecycleResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"UnitLifecycleConfirmationInvalid",
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"FreshSessionRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitLifecycleChanged",
					"UnitLifecycleProtected",
					"UnitAlreadyDeleted",
					"UnitNotDeleted",
					"UnitMergeRequestConflict",
					"GovernanceReversalUnavailable",
				]),
			},
			detail: {
				summary: "Restore a soft-deleted Unit from the platform Console",
				tags: ["Governance"],
			},
		},
	);
