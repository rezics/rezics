import { StatusCodes } from "http-status-codes";
import type { JsonValue } from "@rezics/portable-text";
import * as Data from "effect/Data";

import type {
	EntityAssociationKind,
	EntityAssociationPolicyMode,
} from "../authorization/entity/policy";

export class EntityEntryNotFound extends Data.TaggedError("EntityEntryNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = EntityEntryNotFound.status;
	readonly message = "Entity entry not found";
}

export class EntityAssociationRestricted extends Data.TaggedError("EntityAssociationRestricted") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = EntityAssociationRestricted.status;
	readonly message = "This Entity does not accept that association";
	readonly details: JsonValue;

	constructor(kind: EntityAssociationKind, mode: EntityAssociationPolicyMode) {
		super();
		this.details = { kind, mode };
	}
}

export class CreditAttributionNotFound extends Data.TaggedError("CreditAttributionNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = CreditAttributionNotFound.status;
	readonly message = "Credit attribution not found";
}

export class SubjectAssociationNotFound extends Data.TaggedError("SubjectAssociationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SubjectAssociationNotFound.status;
	readonly message = "Subject association not found";
}

export class EntityAssociationProposalNotFound extends Data.TaggedError(
	"EntityAssociationProposalNotFound",
) {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = EntityAssociationProposalNotFound.status;
	readonly message = "Entity association proposal not found";
}

export class EntityAssociationProposalConflict extends Data.TaggedError(
	"EntityAssociationProposalConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = EntityAssociationProposalConflict.status;
	readonly message = "Entity association proposal conflicts with the current relationship state";
}

export class EntityAssociationProposalExpired extends Data.TaggedError(
	"EntityAssociationProposalExpired",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = EntityAssociationProposalExpired.status;
	readonly message = "Entity association proposal has expired";
}

export class EntityAssociationProposalExpiryInvalid extends Data.TaggedError(
	"EntityAssociationProposalExpiryInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = EntityAssociationProposalExpiryInvalid.status;
	readonly message = "Entity association proposal expiry must be in the future";
}

export const EntityErrors = [
	EntityEntryNotFound,
	EntityAssociationRestricted,
	CreditAttributionNotFound,
	SubjectAssociationNotFound,
	EntityAssociationProposalNotFound,
	EntityAssociationProposalConflict,
	EntityAssociationProposalExpired,
	EntityAssociationProposalExpiryInvalid,
] as const;
