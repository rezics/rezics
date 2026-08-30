import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class InvalidPaginationCursor extends HTTPError.id(
	"InvalidPaginationCursor",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Invalid pagination cursor";
}

export const PaginationErrors = [InvalidPaginationCursor] as const;
