import { StatusCodes } from "http-status-codes";
import type { JsonValue } from "@rezics/portable-text";
import { HTTPError } from "elysia";

import type { AssociationKind, EntityAssociationCommand } from "../authorization/entity/policy";

export class EntityEntryNotFound extends HTTPError.id(
	"EntityEntryNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Entity entry not found";
}

export class EntityAssociationRestricted extends HTTPError.id(
	"EntityAssociationRestricted",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "This Entity does not accept that association";
	readonly details: JsonValue;

	constructor(kind: AssociationKind, command: EntityAssociationCommand) {
		super();
		this.details = { kind, command };
	}
}

export class CreditAttributionNotFound extends HTTPError.id(
	"CreditAttributionNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Credit attribution not found";
}

export class CreditAttributionRoleInvalid extends HTTPError.id(
	"CreditAttributionRoleInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Credit attribution role does not apply to this Unit type";
	readonly details: JsonValue;

	constructor(type: string, role: string) {
		super();
		this.details = { type, role };
	}
}

export class CreditAttributionRequestConfirmationRequired extends HTTPError.id(
	"CreditAttributionRequestConfirmationRequired",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Credit attribution requests require confirmation";
	readonly details: JsonValue;

	constructor(entityIds: readonly string[]) {
		super();
		this.details = { entityIds: [...new Set(entityIds)] };
	}
}

export class SubjectAssociationNotFound extends HTTPError.id(
	"SubjectAssociationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Subject association not found";
}

export const EntityErrors = [
	EntityEntryNotFound,
	EntityAssociationRestricted,
	CreditAttributionNotFound,
	CreditAttributionRoleInvalid,
	CreditAttributionRequestConfirmationRequired,
	SubjectAssociationNotFound,
] as const;
