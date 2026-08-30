import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class InvalidHistoryCursor extends HTTPError.id(
	"InvalidHistoryCursor",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Invalid history cursor";
}

export class UnitRevisionNotFound extends HTTPError.id(
	"UnitRevisionNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Unit revision not found";
}

export class CurrentRevisionContentVisibilityForbidden extends HTTPError.id(
	"CurrentRevisionContentVisibilityForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Restore another revision before hiding the current revision content";
}

export const HistoryErrors = [
	InvalidHistoryCursor,
	UnitRevisionNotFound,
	CurrentRevisionContentVisibilityForbidden,
] as const;
