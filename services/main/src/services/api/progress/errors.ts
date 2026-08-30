import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class ProgressEntryNotFound extends HTTPError.id(
	"ProgressEntryNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Progress entry not found";
}

export const ProgressErrors = [ProgressEntryNotFound] as const;
