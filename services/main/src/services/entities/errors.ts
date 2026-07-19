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

export class EntityOwnershipRequired extends Data.TaggedError("EntityOwnershipRequired") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = EntityOwnershipRequired.status;
	readonly message = "Entity ownership is required";
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

export const EntityErrors = [
	EntityEntryNotFound,
	EntityAssociationRestricted,
	EntityOwnershipRequired,
	CreditAttributionNotFound,
	SubjectAssociationNotFound,
] as const;
