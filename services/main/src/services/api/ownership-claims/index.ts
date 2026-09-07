import Elysia from "elysia";
import { StatusCodes } from "http-status-codes";

import session from "../../auth/session";
import {
	CreateUnitOwnershipClaimBody,
	PendingUnitOwnershipClaimResponse,
	UnitOwnershipClaimParams,
} from "../../ownership-claims/schema";
import {
	createUnitOwnershipClaim,
	withdrawUnitOwnershipClaim,
} from "../../ownership-claims/service";
import { IdResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";

export default new Elysia({ prefix: "/ownership-claims" })
	.use(session)
	.post(
		"",
		{
			access: "session-only",
			body: CreateUnitOwnershipClaimBody,
			response: {
				[StatusCodes.OK]: PendingUnitOwnershipClaimResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitOwnershipClaimUnavailable",
					"UnitOwnershipClaimAlreadyPending",
				]),
			},
			detail: { summary: "Claim ownership of a community-owned Unit", tags: ["Governance"] },
		},
		async ({ entity, body }) => {
			const claim = await createUnitOwnershipClaim({
				unitId: body.unitId,
				claimantProfileId: entity.id,
				details: body.details.trim(),
			});
			return { ...claim, state: "pending" as const };
		},
	)
	.post(
		"/:claimId/withdraw",
		{
			access: "session-only",
			params: UnitOwnershipClaimParams,
			response: {
				[StatusCodes.OK]: IdResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitOwnershipClaimNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitOwnershipClaimChanged"]),
			},
			detail: { summary: "Withdraw a pending Unit ownership claim", tags: ["Governance"] },
		},
		async ({ entity, params }) =>
			withdrawUnitOwnershipClaim({
				claimId: params.claimId,
				claimantProfileId: entity.id,
			}),
	);
