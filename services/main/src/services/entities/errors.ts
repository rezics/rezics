import { StatusCodes } from "http-status-codes";
import type { JsonValue } from "@rezics/portable-text";
import * as Data from "effect/Data";

import type { AssociationKind, EntityAssociationCommand } from "../authorization/entity/policy";

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

	constructor(kind: AssociationKind, command: EntityAssociationCommand) {
		super();
		this.details = { kind, command };
	}
}

export class CreditAttributionNotFound extends Data.TaggedError("CreditAttributionNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = CreditAttributionNotFound.status;
	readonly message = "Credit attribution not found";
}

export class CreditAttributionRoleInvalid extends Data.TaggedError("CreditAttributionRoleInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = CreditAttributionRoleInvalid.status;
	readonly message = "Credit attribution role does not apply to this Unit type";
	readonly details: JsonValue;

	constructor(type: string, role: string) {
		super();
		this.details = { type, role };
	}
}

export class CreditAttributionRequestConfirmationRequired extends Data.TaggedError(
	"CreditAttributionRequestConfirmationRequired",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = CreditAttributionRequestConfirmationRequired.status;
	readonly message = "Credit attribution requests require confirmation";
	readonly details: JsonValue;

	constructor(entityIds: readonly string[]) {
		super();
		this.details = { entityIds: [...new Set(entityIds)] };
	}
}

export class SubjectAssociationNotFound extends Data.TaggedError("SubjectAssociationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SubjectAssociationNotFound.status;
	readonly message = "Subject association not found";
}

export const EntityErrors = [
	EntityEntryNotFound,
	EntityAssociationRestricted,
	CreditAttributionNotFound,
	CreditAttributionRoleInvalid,
	CreditAttributionRequestConfirmationRequired,
	SubjectAssociationNotFound,
] as const;
