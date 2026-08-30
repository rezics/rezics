import type { StaticDecode } from "typebox";
import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

import session from "../../auth/session";
import {
	decidePlatformUnitOwnershipClaim,
	listPlatformUnitOwnershipClaims,
} from "../../ownership-claims/service";
import {
	DecideUnitOwnershipClaimBody,
	ListPlatformUnitOwnershipClaimsQuery,
	PlatformUnitOwnershipClaimListResponse,
	UnitOwnershipClaimDecisionResponse,
	UnitOwnershipClaimParams,
} from "../../ownership-claims/schema";
import {
	decodeUnitOwnershipClaimCursor,
	encodeUnitOwnershipClaimCursor,
} from "../../ownership-claims/cursor";
import { toApiErrorResponse } from "../schema/response";
import { UnitOwnershipClaimConfirmationInvalid } from "../../ownership-claims/errors";

export default new Elysia({ prefix: "/platform/ownership-claims" })
	.use(session)
	.get(
		"",
		{
			access: "session-only",
			query: ListPlatformUnitOwnershipClaimsQuery,
			response: {
				[StatusCodes.OK]: PlatformUnitOwnershipClaimListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidPaginationCursor"]),
			},
			detail: { summary: "List platform Unit ownership claims", tags: ["Governance"] },
		},
		async ({ authorization, query }) => {
			await authorization.platform.ensureCapability("unit.governance.read");
			const result = await listPlatformUnitOwnershipClaims({
				state: query.state,
				cursor: decodeUnitOwnershipClaimCursor(query.cursor),
				limit: query.limit ?? 50,
			});
			const response: StaticDecode<typeof PlatformUnitOwnershipClaimListResponse> = {
				items: result.items,
				nextCursor: result.nextCursor ? encodeUnitOwnershipClaimCursor(result.nextCursor) : null,
			};
			return response;
		},
	)
	.post(
		"/:claimId/decision",
		{
			access: "fresh-session-only",
			params: UnitOwnershipClaimParams,
			body: DecideUnitOwnershipClaimBody,
			response: {
				[StatusCodes.OK]: UnitOwnershipClaimDecisionResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"UnitOwnershipClaimConfirmationInvalid",
					"GovernanceRuleSourceForbidden",
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"PlatformCapabilityRequired",
					"FreshSessionRequired",
					"UnitOwnershipClaimSelfDecisionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitOwnershipClaimNotFound", "UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitOwnershipClaimChanged",
					"GovernanceRuleChanged",
				]),
			},
			detail: { summary: "Resolve a Unit ownership claim", tags: ["Governance"] },
		},
		async ({ authorization, profile, params, body }) => {
			if (body.confirmationClaimId !== params.claimId)
				throw new UnitOwnershipClaimConfirmationInvalid();
			return decidePlatformUnitOwnershipClaim(authorization.platform, {
				claimId: params.claimId,
				actorProfileId: profile.unitId,
				decision: body.decision,
				rules: body.rules,
				note: body.note?.trim() || undefined,
				contribution: body.revisionContext?.contribution,
			});
		},
	);
